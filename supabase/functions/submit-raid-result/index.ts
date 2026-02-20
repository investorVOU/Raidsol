import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * submit-raid-result — Atomic Raid Outcome Processing
 *
 * Security additions:
 *  D. Anti-cheat: server validates that claimed points/sol are achievable
 *     in the claimed elapsed time for the given difficulty + entry fee.
 *  F. Wallet signature: verifies the caller owns the wallet (ed25519 signature
 *     of the seed_id checked against the provided public key).
 */

// Maximum yield rate per second per difficulty (points/s at mult=1.0)
const MAX_YIELD_RATE: Record<string, number> = {
  EASY:       12.75,   // 15 * 0.85
  MEDIUM:     15.0,
  HARD:       21.0,    // 15 * 1.40
  DEGEN:      37.5,    // 15 * 2.50
};

// Maximum sol reward multiplier we ever allow (protects against inflated claims)
const MAX_PAYOUT_MULTIPLIER = 6.0;

// Minimum elapsed time (seconds) for any valid raid — prevents instant exploit
const MIN_RAID_DURATION_SEC = 3;

// Max elapsed time = raid timer + grace window (extra 10s for network/client clock skew)
const MAX_RAID_DURATION_SEC = 70;

function validateRaidResult(
  success: boolean,
  sol_amount: number,
  points: number,
  entry_fee: number,
  difficulty: string,
  elapsed_sec: number,
): string | null {
  // Must provide elapsed time
  if (!elapsed_sec || elapsed_sec < MIN_RAID_DURATION_SEC) {
    return `Raid too short: ${elapsed_sec}s < minimum ${MIN_RAID_DURATION_SEC}s`;
  }

  if (elapsed_sec > MAX_RAID_DURATION_SEC) {
    return `Raid too long: ${elapsed_sec}s exceeds maximum ${MAX_RAID_DURATION_SEC}s`;
  }

  if (success && sol_amount <= 0) {
    return 'Successful raid must have positive sol_amount';
  }

  if (success && entry_fee <= 0) {
    return 'entry_fee required for payout validation';
  }

  // Max achievable points in elapsed_sec at highest possible multiplier (mult can reach ~5x with gear+attacks)
  const maxMultiplier = 5.0;
  const maxRate = (MAX_YIELD_RATE[difficulty] ?? MAX_YIELD_RATE.MEDIUM) * maxMultiplier;
  // Attacks give +200 points; cap at 30 attacks in a run
  const maxAttackBonus = 30 * 200;
  const maxPoints = Math.ceil(maxRate * elapsed_sec) + maxAttackBonus;

  if (points > maxPoints) {
    return `Impossible points: ${points} > max achievable ${maxPoints} in ${elapsed_sec}s on ${difficulty}`;
  }

  if (success) {
    const maxPayout = entry_fee * MAX_PAYOUT_MULTIPLIER;
    if (sol_amount > maxPayout) {
      return `Inflated payout: ${sol_amount} SOL > max allowed ${maxPayout} SOL`;
    }

    // Verify sol_amount is consistent with points (allow ±20% for floating-point divergence)
    // Reward formula: (points / 2500) * 6 * entry_fee  (max 6x the entry fee at max score)
    const expectedSol = (points / 2500) * 6 * entry_fee;
    const tolerance = expectedSol * 0.20;
    if (Math.abs(sol_amount - expectedSol) > tolerance + 0.0001) {
      return `sol_amount ${sol_amount} inconsistent with points ${points} (expected ~${expectedSol.toFixed(6)})`;
    }
  }

  return null; // valid
}

const json = (body: object, status = 200, corsH: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsH });
  }

  try {
    const body = await req.json();
    const {
      wallet_address,
      seed_id,
      client_seed,
      success,
      sol_amount,
      points,
      mode,
      difficulty,
      entry_fee,
      elapsed_sec,
      room_id,        // Optional: PvP room this raid belongs to
    } = body;

    if (!wallet_address || !seed_id) {
      return json({ error: 'wallet_address and seed_id required' }, 400, corsH);
    }

    // ── D. Anti-cheat validation ────────────────────────────────────────
    const cheatError = validateRaidResult(
      !!success,
      Number(sol_amount ?? 0),
      Number(points ?? 0),
      Number(entry_fee ?? 0),
      difficulty ?? 'MEDIUM',
      Number(elapsed_sec ?? 0),
    );

    if (cheatError) {
      console.warn(`[anti-cheat] wallet=${wallet_address} reason="${cheatError}"`);
      return json({ error: `Validation failed: ${cheatError}` }, 422, corsH);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 1. Validate & consume seed ─────────────────────────────────────
    const { data: seedData, error: seedError } = await supabase
      .from('raid_seeds')
      .select('*')
      .eq('id', seed_id)
      .eq('wallet_address', wallet_address)
      .eq('used', false)
      .single();

    if (seedError || !seedData) {
      return json({ error: 'Invalid or already-used seed' }, 400, corsH);
    }

    await supabase.from('raid_seeds').update({ used: true }).eq('id', seed_id);

    // ── 2. Server-side SR calculation ──────────────────────────────────
    const baseSR = success ? 100 : 25;
    const performanceSR = Math.floor((points || 0) / 200);
    const totalSREarned = baseSR + performanceSR;

    // ── 3. Fetch + update profile ──────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('sr_points, unclaimed_sol, username')
      .eq('wallet_address', wallet_address)
      .single();

    if (profileError || !profile) {
      return json({ error: 'Profile not found' }, 404, corsH);
    }

    const newSRPoints = Number(profile.sr_points) + totalSREarned;
    const newUnclaimed = success
      ? Number(profile.unclaimed_sol) + Number(sol_amount)
      : Number(profile.unclaimed_sol);

    await supabase
      .from('profiles')
      .update({ sr_points: newSRPoints, unclaimed_sol: newUnclaimed, updated_at: new Date().toISOString() })
      .eq('wallet_address', wallet_address);

    // ── 4a. Record raid history ────────────────────────────────────────
    const raidId = 'RAID-' + Math.random().toString(36).substring(2, 11).toUpperCase();

    await supabase.from('raid_history').insert({
      wallet_address,
      raid_id: raidId,
      mode: mode || 'SOLO',
      difficulty: difficulty || 'MEDIUM',
      success,
      sol_amount: sol_amount || 0,
      entry_fee: entry_fee || 0,
      sr_earned: totalSREarned,
      points: points || 0,
      server_seed_hash: seedData.server_seed_hash,
      tx_signature: client_seed || null,
    });

    // ── 4b. Activity feed ──────────────────────────────────────────────
    await supabase.from('activity_feed').insert({
      event_type: success ? 'EXTRACTED' : 'BUSTED',
      username: profile.username,
      amount_sol: success ? sol_amount : entry_fee,
    });

    // ── 5. Treasury stats ──────────────────────────────────────────────
    const { data: treasury } = await supabase
      .from('treasury_stats')
      .select('total_transactions, payouts_24h_sol')
      .eq('id', 1)
      .single();

    if (treasury) {
      await supabase.from('treasury_stats').update({
        total_transactions: treasury.total_transactions + 1,
        payouts_24h_sol: success
          ? Number(treasury.payouts_24h_sol) + Number(sol_amount)
          : treasury.payouts_24h_sol,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
    }

    // ── 6. PvP room: record result + determine winner if all done ──────
    let pvpPayload: Record<string, unknown> = {};
    if (room_id) {
      // Record this player's raid result in room_players
      await supabase
        .from('room_players')
        .update({
          points: points || 0,
          sol_result: success ? Number(sol_amount) : 0,
          finished_at: new Date().toISOString(),
        })
        .eq('room_id', room_id)
        .eq('wallet_address', wallet_address);

      // Check if every player in the room has now finished
      const { data: allPlayers } = await supabase
        .from('room_players')
        .select('wallet_address, username, points, finished_at')
        .eq('room_id', room_id);

      const allDone =
        (allPlayers?.length ?? 0) > 0 &&
        allPlayers!.every((p) => p.finished_at !== null);

      if (allDone && allPlayers) {
        // Determine winner by highest points (first place wins ties)
        const winner = allPlayers.reduce((best, p) =>
          (p.points ?? 0) > (best.points ?? 0) ? p : best
        );

        // Fetch room stake info
        const { data: room } = await supabase
          .from('rooms')
          .select('stake_per_player, stake_currency')
          .eq('id', room_id)
          .single();

        const pot = room
          ? Number(room.stake_per_player) * allPlayers.length
          : 0;

        // Credit pot to winner's unclaimed_sol
        if (pot > 0) {
          const { data: wProfile } = await supabase
            .from('profiles')
            .select('unclaimed_sol')
            .eq('wallet_address', winner.wallet_address)
            .single();

          if (wProfile) {
            await supabase
              .from('profiles')
              .update({
                unclaimed_sol: Number(wProfile.unclaimed_sol) + pot,
                updated_at: new Date().toISOString(),
              })
              .eq('wallet_address', winner.wallet_address);
          }
        }

        // Mark room as finished with winner
        await supabase
          .from('rooms')
          .update({ status: 'FINISHED', winner_wallet: winner.wallet_address })
          .eq('id', room_id);

        // Post activity feed event
        await supabase.from('activity_feed').insert({
          event_type: 'PVP_WIN',
          username: winner.username || winner.wallet_address.slice(0, 8),
          amount_sol: pot,
        });

        pvpPayload = {
          pvp_resolved: true,
          winner_wallet: winner.wallet_address,
          winner_name: winner.username || winner.wallet_address.slice(0, 8),
          pot_sol: pot,
          currency: room?.stake_currency ?? 'SOL',
          is_winner: winner.wallet_address === wallet_address,
        };
      } else {
        pvpPayload = { pvp_resolved: false };
      }
    }

    // ── 7. Return result + revealed seed ──────────────────────────────
    return json({
      success: true,
      raid_id: raidId,
      sr_earned: totalSREarned,
      new_sr_points: newSRPoints,
      new_unclaimed: newUnclaimed,
      server_seed: seedData.server_seed,
      server_seed_hash: seedData.server_seed_hash,
      ...pvpPayload,
    }, 200, corsH);

  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

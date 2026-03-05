import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * submit-raid-result — Atomic Raid Outcome Processing
 *
 * Anti-cheat strategy:
 *   - Impossible SOL payouts → zeroed (force-bust), round entry still recorded
 *   - Impossible points     → clamped to max achievable, round entry recorded
 *   - Only hard early-return: elapsed_sec < 3 (instant exploit) or missing required fields
 *   - Drill mode is never recorded (pure simulation)
 */

// Platform fees
const PLATFORM_FEE_RAID = 0.05; // 5% of sol_amount on wins
const PLATFORM_FEE_PVP  = 0.10; // 10% of PvP pot

// Maximum yield rate per second per difficulty (points/s at mult=1.0)
const MAX_YIELD_RATE: Record<string, number> = {
  EASY:       12.75,   // 15 * 0.85
  MEDIUM:     15.0,
  HARD:       21.0,    // 15 * 1.40
  DEGEN:      37.5,    // 15 * 2.50
};

// Max SOL payout per difficulty at 5,000 points (must match client DIFFICULTY_MAX_WIN in types.ts)
const DIFFICULTY_MAX_WIN: Record<string, number> = {
  EASY:   0.03,
  MEDIUM: 0.07,
  HARD:   0.20,
  DEGEN:  0.60,
};

// Minimum elapsed time (seconds) — below this is clearly an instant-submit exploit
const MIN_RAID_DURATION_SEC = 3;

/**
 * Clamp raid result values to physically achievable maximums.
 * Returns { effectiveSuccess, effectiveSolAmount, effectivePoints, flagged, reason }
 * so the caller can always proceed — never hard-rejects (except elapsed < MIN).
 */
function clampRaidResult(
  success: boolean,
  sol_amount: number,
  points: number,
  difficulty: string,
  elapsed_sec: number,
): { effectiveSuccess: boolean; effectiveSolAmount: number; effectivePoints: number; flagged: boolean; reason: string | null } {
  let effectiveSuccess = success;
  let effectiveSolAmount = sol_amount;
  let effectivePoints = points;
  let flagged = false;
  let reason: string | null = null;

  // Max achievable points given elapsed time (no upper cap on duration)
  const maxMultiplier = 5.0;
  const maxRate = (MAX_YIELD_RATE[difficulty] ?? MAX_YIELD_RATE.MEDIUM) * maxMultiplier;
  // Attacks give +200 points (cap 30); skill checks up to +200 pts each (cap 6 triggers)
  const maxAttackBonus = 30 * 200 + 6 * 200;
  const maxPoints = Math.ceil(maxRate * Math.max(elapsed_sec, 0)) + maxAttackBonus;

  if (points > maxPoints) {
    flagged = true;
    reason = `Points clamped: ${points} > max ${maxPoints} in ${elapsed_sec}s on ${difficulty}`;
    effectivePoints = maxPoints;
    // Impossible points → treat as bust, no payout
    effectiveSuccess = false;
    effectiveSolAmount = 0;
  }

  if (success && sol_amount <= 0) {
    flagged = true;
    reason = reason ?? 'Successful raid had zero sol_amount — zeroing payout';
    effectiveSuccess = false;
    effectiveSolAmount = 0;
  }

  if (success && !flagged) {
    // Max payout = difficulty cap × 2× DON × 1.1 ticket × 1.05 golden × 1.15 tolerance
    const maxForDiff = DIFFICULTY_MAX_WIN[difficulty] ?? DIFFICULTY_MAX_WIN.MEDIUM;
    const maxPayout = maxForDiff * 2.0 * 1.1 * 1.05 * 1.15;

    if (sol_amount > maxPayout) {
      flagged = true;
      reason = `Payout clamped: ${sol_amount} SOL > absolute max ${maxPayout.toFixed(6)} SOL for ${difficulty}`;
      effectiveSolAmount = 0;
      effectiveSuccess = false;
    } else {
      // Cross-check: expected base + generous tolerance for all bonuses
      const expectedBase = (effectivePoints / 5000) * maxForDiff * (1 - PLATFORM_FEE_RAID);
      const maxExpected = expectedBase * 2.5 + 0.0001;
      if (sol_amount > maxExpected) {
        flagged = true;
        reason = `Payout clamped: ${sol_amount} SOL > max expected ${maxExpected.toFixed(6)} SOL for ${effectivePoints} pts`;
        effectiveSolAmount = 0;
        effectiveSuccess = false;
      }
    }
  }

  return { effectiveSuccess, effectiveSolAmount, effectivePoints, flagged, reason };
}

const json = (body: object, status = 200, corsH: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });

/** Fire-and-forget push notification to a single wallet. Never throws. */
async function notifyWallet(
  wallet: string,
  title: string,
  body: string,
  url = '/',
) {
  try {
    await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ wallet_address: wallet, title, body, url }),
      },
    );
  } catch (e) {
    console.error('[notify] push failed for', wallet, e);
  }
}

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
      entry_tx_sig,   // On-chain tx signature for entry fee payment
      elapsed_sec,
      peak_mult,      // Optional: peak multiplier reached during raid
      insurance,      // Optional: boolean — player paid +0.01 SOL insurance
      raid_tier,      // Optional: competition tier (GRUNT | ELITE | WHALE), default GRUNT
      room_id,        // Optional: PvP room this raid belongs to
    } = body;

    if (!wallet_address || !seed_id) {
      return json({ error: 'wallet_address and seed_id required' }, 400, corsH);
    }

    // Drill = pure simulation, never recorded anywhere
    const isDrill = (mode ?? '').toUpperCase() === 'DRILL';

    // ── Hard early-return: instant-submit exploit (< 3s) ────────────────
    const rawElapsed = Number(elapsed_sec ?? 0);
    if (!isDrill && rawElapsed < MIN_RAID_DURATION_SEC) {
      console.warn(`[anti-cheat] wallet=${wallet_address} elapsed=${rawElapsed}s — instant exploit rejected`);
      return json({ error: `Raid too short (${rawElapsed}s)` }, 422, corsH);
    }

    // ── Payment verification (non-drill raids with an entry fee) ────────
    // If the client sent a tx signature, confirm it landed on-chain and paid
    // the correct treasury address. Drills and free raids (entry_fee=0) skip this.
    const feeNum = Number(entry_fee ?? 0);
    if (!isDrill && feeNum > 0) {
      if (!entry_tx_sig) {
        console.warn(`[anti-cheat] wallet=${wallet_address} — entry_fee=${feeNum} but no entry_tx_sig`);
        return json({ error: 'Entry fee transaction signature required' }, 422, corsH);
      }

      const RPC_URLS = [
        Deno.env.get('HELIUS_RPC_URL'),
        Deno.env.get('ALCHEMY_RPC_URL'),
        Deno.env.get('SOLANA_RPC_URL'),
        'https://api.mainnet-beta.solana.com',
      ].filter((u): u is string => typeof u === 'string' && u.startsWith('http'));
      const TREASURY = Deno.env.get('TREASURY_ADDRESS') ?? '';
      const LAMPORTS_PER_SOL = 1_000_000_000;
      const expectedLamports = Math.round(feeNum * LAMPORTS_PER_SOL);

      try {
        // Retry across all RPC endpoints (up to 6 attempts total) with 1s gap
        let txData: any = null;
        let attempt = 0;
        outer: for (let round = 0; round < 3; round++) {
          for (const rpcUrl of RPC_URLS) {
            if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
            attempt++;
            try {
              const rpcRes = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0', id: 1,
                  method: 'getTransaction',
                  params: [entry_tx_sig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
                }),
              });
              const rpcJson = await rpcRes.json();
              if (rpcJson.result) { txData = rpcJson.result; break outer; }
            } catch { /* try next endpoint */ }
          }
        }

        if (!txData) {
          console.warn(`[anti-cheat] wallet=${wallet_address} — entry tx ${entry_tx_sig} not found on-chain`);
          return json({ error: 'Entry fee transaction not confirmed on-chain' }, 422, corsH);
        }

        if (txData.meta?.err) {
          console.warn(`[anti-cheat] wallet=${wallet_address} — entry tx failed on-chain`, txData.meta.err);
          return json({ error: 'Entry fee transaction failed on-chain' }, 422, corsH);
        }

        // Check that the tx moved at least the expected lamports to the treasury.
        // Works for SOL (system transfer) and SPL tokens (check postTokenBalances).
        let treasuryReceived = false;
        const instructions = txData.transaction?.message?.instructions ?? [];
        for (const ix of instructions) {
          if (ix.parsed?.type === 'transfer' && ix.parsed?.info?.destination === TREASURY) {
            if (Number(ix.parsed.info.lamports ?? 0) >= expectedLamports * 0.98) {
              treasuryReceived = true; break;
            }
          }
          if (ix.parsed?.type === 'transferChecked' && ix.parsed?.info?.destination === TREASURY) {
            treasuryReceived = true; break;
          }
        }
        // SPL token transfer via postTokenBalances
        if (!treasuryReceived && TREASURY) {
          const pre  = txData.meta?.preTokenBalances  ?? [];
          const post = txData.meta?.postTokenBalances ?? [];
          for (const p of post) {
            if (p.owner === TREASURY) {
              const preEntry = pre.find((e: any) => e.accountIndex === p.accountIndex);
              const delta = Number(p.uiTokenAmount.amount) - Number(preEntry?.uiTokenAmount?.amount ?? 0);
              if (delta > 0) { treasuryReceived = true; break; }
            }
          }
        }

        if (!treasuryReceived) {
          console.warn(`[anti-cheat] wallet=${wallet_address} — treasury not credited in tx ${entry_tx_sig}`);
          return json({ error: 'Entry fee not received by treasury' }, 422, corsH);
        }

        console.log(`[payment] verified entry_tx_sig=${entry_tx_sig} for wallet=${wallet_address} fee=${feeNum}`);
      } catch (verifyErr) {
        // RPC verification failed — log and allow through to avoid blocking legit users
        // on RPC downtime. The tx sig is stored and can be audited offline.
        console.error(`[payment] verification error for wallet=${wallet_address}:`, verifyErr);
      }
    }

    // ── D. Anti-cheat: clamp values, never drop the round entry ─────────
    const { effectiveSuccess, effectiveSolAmount, effectivePoints, flagged, reason } = clampRaidResult(
      !!success,
      Number(sol_amount ?? 0),
      Number(points ?? 0),
      difficulty ?? 'MEDIUM',
      rawElapsed,
    );

    if (flagged) {
      console.warn(`[anti-cheat] wallet=${wallet_address} ${reason} — recording as bust, zeroing payout`);
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
    const baseSR = effectiveSuccess ? 100 : 25;
    const performanceSR = Math.floor(effectivePoints / 200);
    let totalSREarned = baseSR + performanceSR;

    // ── 3. Fetch + update profile ──────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('sr_points, unclaimed_sol, username, daily_streak, last_played_date')
      .eq('wallet_address', wallet_address)
      .single();

    if (profileError || !profile) {
      return json({ error: 'Profile not found' }, 404, corsH);
    }

    // ── Daily streak computation ────────────────────────────────────────
    const todayUTC     = new Date().toISOString().slice(0, 10);
    const yesterdayUTC = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const lastPlayed   = profile.last_played_date as string | null;
    let newStreak      = (profile.daily_streak as number) ?? 0;

    if (!lastPlayed) {
      newStreak = 1;
    } else if (lastPlayed === yesterdayUTC) {
      newStreak = newStreak + 1;
    } else if (lastPlayed === todayUTC) {
      // Already played today — keep streak as-is
    } else {
      newStreak = 1; // streak broken
    }

    // +10% SR per streak day, capped at +40% (day 5+)
    if (!isDrill) {
      const streakBonus = 1 + Math.min(newStreak - 1, 4) * 0.10;
      totalSREarned = Math.round(totalSREarned * streakBonus);
    }

    // ── Daily bounty check ─────────────────────────────────────────────
    // Only applies to paid, non-drill, non-pvp extractions
    let bountyAwarded = 0;
    let bountyId: number | null = null;
    if (!isDrill && effectiveSuccess && Number(entry_fee) > 0) {
      const DAILY_BOUNTIES = [
        { id: 0, condition: 'extracted'      },
        { id: 1, condition: 'peak_mult_gte',  conditionValue: 2.0 },
        { id: 2, condition: 'points_gte',     conditionValue: 3000 },
        { id: 3, condition: 'elapsed_lte',    conditionValue: 35   },
        { id: 4, condition: 'difficulty_eq',  conditionLabel: 'HARD' },
        { id: 5, condition: 'peak_mult_gte',  conditionValue: 3.0 },
        { id: 6, condition: 'difficulty_eq',  conditionLabel: 'DEGEN' },
        { id: 7, condition: 'points_gte',     conditionValue: 1500 },
        { id: 8, condition: 'elapsed_lte',    conditionValue: 50   },
        { id: 9, condition: 'peak_mult_gte',  conditionValue: 1.5 },
      ];
      const BOUNTY_SR = [300, 500, 600, 400, 700, 800, 1200, 350, 300, 250];

      const dayIndex = Math.floor(Date.now() / 86_400_000);
      const todayBounty = DAILY_BOUNTIES[dayIndex % DAILY_BOUNTIES.length] as {
        id: number; condition: string; conditionValue?: number; conditionLabel?: string;
      };

      // Check if already claimed today
      const { data: existingClaim } = await supabase
        .from('daily_bounty_claims')
        .select('id')
        .eq('wallet_address', wallet_address)
        .eq('day_index', dayIndex)
        .maybeSingle();

      if (!existingClaim) {
        const diff = (difficulty ?? 'MEDIUM').toUpperCase();
        const pm   = Number(peak_mult ?? 0);
        const el   = rawElapsed;
        const pts  = effectivePoints;

        let met = false;
        if (todayBounty.condition === 'extracted')     met = true;
        if (todayBounty.condition === 'peak_mult_gte') met = pm >= (todayBounty.conditionValue ?? 0);
        if (todayBounty.condition === 'points_gte')    met = pts >= (todayBounty.conditionValue ?? 0);
        if (todayBounty.condition === 'elapsed_lte')   met = el <= (todayBounty.conditionValue ?? 999);
        if (todayBounty.condition === 'difficulty_eq') met = diff === (todayBounty.conditionLabel ?? '');

        if (met) {
          bountyAwarded = BOUNTY_SR[todayBounty.id] ?? 0;
          bountyId = todayBounty.id;
          totalSREarned += bountyAwarded;
          await supabase.from('daily_bounty_claims').insert({
            wallet_address,
            bounty_id: todayBounty.id,
            day_index: dayIndex,
            sr_awarded: bountyAwarded,
          });
          console.log(`[bounty] wallet=${wallet_address} bounty=${todayBounty.id} sr=${bountyAwarded}`);
        }
      }
    }

    const newSRPoints = Number(profile.sr_points) + totalSREarned;
    // Drill mode: practice only — no SOL payout regardless of outcome
    // Insurance: on bust, refund 50% of entry fee to unclaimed_sol
    const insuranceRefund = (!effectiveSuccess && !isDrill && !!insurance)
      ? Number(entry_fee ?? 0) * 0.5
      : 0;

    // Push: insurance payout on bust
    if (insuranceRefund > 0) {
      notifyWallet(
        wallet_address,
        'Insurance paid out',
        `You busted — but your insurance refunded ${insuranceRefund.toFixed(4)} SOL back to your wallet.`,
        '/',
      );
    }

    const newUnclaimed = !isDrill
      ? Number(profile.unclaimed_sol) + (effectiveSuccess ? effectiveSolAmount : 0) + insuranceRefund
      : Number(profile.unclaimed_sol);

    await supabase
      .from('profiles')
      .update({
        sr_points:        newSRPoints,
        unclaimed_sol:    newUnclaimed,
        daily_streak:     isDrill ? profile.daily_streak : newStreak,
        last_played_date: isDrill ? profile.last_played_date : todayUTC,
        updated_at:       new Date().toISOString(),
      })
      .eq('wallet_address', wallet_address);

    // ── 4a. Record raid history ────────────────────────────────────────
    const raidId = 'RAID-' + Math.random().toString(36).substring(2, 11).toUpperCase();

    await supabase.from('raid_history').insert({
      wallet_address,
      raid_id: raidId,
      mode: mode || 'SOLO',
      difficulty: difficulty || 'MEDIUM',
      raid_tier: raid_tier || 'GRUNT',
      success: effectiveSuccess,
      sol_amount: effectiveSolAmount,
      entry_fee: entry_fee || 0,
      entry_tx_sig: entry_tx_sig || null,
      sr_earned: totalSREarned,
      points: effectivePoints,
      server_seed_hash: seedData.server_seed_hash,
      tx_signature: client_seed || null,
    });

    // ── 4a-ii. Achievement checks ──────────────────────────────────────
    let newAchievements: string[] = [];
    if (!isDrill) {
      const [{ count: totalRaids }, { count: totalWins }] = await Promise.all([
        supabase.from('raid_history').select('*', { count: 'exact', head: true }).eq('wallet_address', wallet_address),
        supabase.from('raid_history').select('*', { count: 'exact', head: true }).eq('wallet_address', wallet_address).eq('success', true),
      ]);

      const toGrant: string[] = [];
      if (totalRaids === 1)   toGrant.push('FIRST_RAID');
      if (totalWins  === 1)   toGrant.push('FIRST_EXTRACT');
      if (totalRaids === 10)  toGrant.push('RAIDS_10');
      if (totalRaids === 50)  toGrant.push('RAIDS_50');
      if (totalRaids === 100) toGrant.push('RAIDS_100');
      if (totalWins  === 10)  toGrant.push('WINS_10');
      if (totalWins  === 50)  toGrant.push('WINS_50');
      if (effectiveSuccess && (difficulty ?? 'MEDIUM').toUpperCase() === 'DEGEN') toGrant.push('DEGEN_SURVIVE');
      if (effectivePoints >= 4000) toGrant.push('HIGH_SCORE');
      if (newStreak === 3) toGrant.push('STREAK_3');
      if (newStreak === 7) toGrant.push('STREAK_7');
      // PVP_WIN is checked after pvpPayload resolution — see step 6

      if (toGrant.length > 0) {
        const { data: inserted } = await supabase
          .from('achievements')
          .upsert(
            toGrant.map(id => ({ wallet_address, achievement_id: id })),
            { onConflict: 'wallet_address,achievement_id', ignoreDuplicates: true },
          )
          .select('achievement_id');
        // Only return achievements that were actually newly inserted (not pre-existing)
        newAchievements = (inserted ?? []).map((r: { achievement_id: string }) => r.achievement_id);
        if (newAchievements.length === 0 && toGrant.length > 0) {
          // ignoreDuplicates suppresses returning; fall back to returning all granted
          newAchievements = toGrant;
        }
        console.log(`[achievements] wallet=${wallet_address} granted=${toGrant.join(',')}`);
      }
    }

    // ── 4b. Round pool + live entry ────────────────────────────────────
    // Recorded for ALL paid non-PvP non-drill raids, regardless of win/bust/flag.
    // Players always appear in round standings the moment they submit.
    if (!isDrill && !room_id && Number(entry_fee) > 0) {
      const raidNow = new Date();
      const utcHour = raidNow.getUTCHours();
      const raidRoundNum  = Math.floor(utcHour / 6) + 1;
      const ry = raidNow.getUTCFullYear();
      const rm = raidNow.getUTCMonth() + 1;
      const rd = raidNow.getUTCDate();
      const raidRoundDate = `${ry}-${String(rm).padStart(2, '0')}-${String(rd).padStart(2, '0')}`;
      const poolContribution = Number(entry_fee) * 0.90;

      // Check if this wallet has already entered this round/tier window.
      // Each wallet contributes to the prize pool exactly ONCE per round —
      // subsequent attempts only update their best score, not the pool.
      const { data: existingEntry } = await supabase
        .from('round_entries')
        .select('id')
        .eq('wallet_address', wallet_address)
        .eq('round_number', raidRoundNum)
        .eq('round_date', raidRoundDate)
        .eq('raid_tier', raid_tier || 'GRUNT')
        .maybeSingle();

      const isFirstEntry = !existingEntry;

      // Snapshot top-5 BEFORE this entry so we can detect displacements
      const { data: prevTop5 } = await supabase
        .from('round_entries')
        .select('wallet_address, best_points')
        .eq('round_number', raidRoundNum)
        .eq('round_date', raidRoundDate)
        .eq('raid_tier', raid_tier || 'GRUNT')
        .order('best_points', { ascending: false })
        .limit(5);

      // Only increment pool on first entry — prevents same wallet from inflating the prize pool
      const ops: Promise<any>[] = [
        supabase.rpc('upsert_round_entry', {
          p_round_number: raidRoundNum,
          p_round_date:   raidRoundDate,
          p_raid_tier:    raid_tier || 'GRUNT',
          p_wallet:       wallet_address,
          p_username:     profile.username,
          p_points:       effectivePoints,
        }),
      ];
      if (isFirstEntry) {
        ops.push(supabase.rpc('increment_round_pool', {
          p_round_number: raidRoundNum,
          p_round_date:   raidRoundDate,
          p_amount:       poolContribution,
          p_raid_tier:    raid_tier || 'GRUNT',
        }));
      }

      const [entryResult, poolResult] = await Promise.all(ops);

      if (entryResult?.error) console.error('[round] upsert_round_entry error:', entryResult.error.message);
      if (poolResult?.error)  console.error('[round] increment_round_pool error:', poolResult.error.message);
      console.log(`[round] wallet=${wallet_address} round=${raidRoundNum} isFirstEntry=${isFirstEntry} poolContrib=${isFirstEntry ? poolContribution : 0}`);

      // Push: notify wallets knocked out of the top 5
      const { data: newTop5 } = await supabase
        .from('round_entries')
        .select('wallet_address, best_points')
        .eq('round_number', raidRoundNum)
        .eq('round_date', raidRoundDate)
        .eq('raid_tier', raid_tier || 'GRUNT')
        .order('best_points', { ascending: false })
        .limit(5);

      const newTop5Wallets = new Set((newTop5 ?? []).map((e: { wallet_address: string }) => e.wallet_address));
      for (const entry of (prevTop5 ?? []) as { wallet_address: string; best_points: number }[]) {
        if (
          entry.wallet_address !== wallet_address &&
          !newTop5Wallets.has(entry.wallet_address)
        ) {
          notifyWallet(
            entry.wallet_address,
            'You\'ve been overtaken',
            'Someone just pushed you out of the top 5 this round. Raid again to reclaim your spot.',
            '/',
          );
        }
      }

      console.log(`[round] wallet=${wallet_address} round=${raidRoundDate}#${raidRoundNum} pts=${effectivePoints} pool+=${poolContribution}`);
    }

    // ── 4c. Activity feed ──────────────────────────────────────────────
    if (!isDrill) {
      await supabase.from('activity_feed').insert({
        event_type: effectiveSuccess ? 'EXTRACTED' : 'BUSTED',
        username: profile.username,
        amount_sol: effectiveSuccess ? effectiveSolAmount : (entry_fee || 0),
      });
    }

    // ── 5. Treasury stats ──────────────────────────────────────────────
    if (!isDrill) {
      const { data: treasury } = await supabase
        .from('treasury_stats')
        .select('total_transactions, payouts_24h_sol')
        .eq('id', 1)
        .single();

      if (treasury) {
        const platformFeeRaid = effectiveSuccess ? effectiveSolAmount * PLATFORM_FEE_RAID / (1 - PLATFORM_FEE_RAID) : 0;
        await supabase.from('treasury_stats').update({
          total_transactions: treasury.total_transactions + 1,
          payouts_24h_sol: effectiveSuccess
            ? Number(treasury.payouts_24h_sol) + effectiveSolAmount
            : treasury.payouts_24h_sol,
          updated_at: new Date().toISOString(),
        }).eq('id', 1);
        if (effectiveSuccess) console.log(`[fee] raid net=${effectiveSolAmount} platform_fee≈${platformFeeRaid.toFixed(6)} SOL`);
      }
    }

    // ── 6. PvP room: record result + determine winner if all done ──────
    let pvpPayload: Record<string, unknown> = {};
    if (room_id) {
      await supabase
        .from('room_players')
        .update({
          points: effectivePoints,
          sol_result: effectiveSuccess ? effectiveSolAmount : 0,
          finished_at: new Date().toISOString(),
        })
        .eq('room_id', room_id)
        .eq('wallet_address', wallet_address);

      const { data: allPlayers } = await supabase
        .from('room_players')
        .select('wallet_address, username, points, finished_at')
        .eq('room_id', room_id);

      const allDone =
        (allPlayers?.length ?? 0) > 0 &&
        allPlayers!.every((p) => p.finished_at !== null);

      if (allDone && allPlayers) {
        const winner = allPlayers.reduce((best, p) =>
          (p.points ?? 0) > (best.points ?? 0) ? p : best
        );

        const { data: room } = await supabase
          .from('rooms')
          .select('stake_per_player, stake_currency')
          .eq('id', room_id)
          .single();

        const grossPot = room ? Number(room.stake_per_player) * allPlayers.length : 0;
        const netPot = grossPot * (1 - PLATFORM_FEE_PVP);
        const platformFeePvp = grossPot - netPot;

        if (netPot > 0) {
          const { data: wProfile } = await supabase
            .from('profiles')
            .select('unclaimed_sol')
            .eq('wallet_address', winner.wallet_address)
            .single();

          if (wProfile) {
            await supabase
              .from('profiles')
              .update({
                unclaimed_sol: Number(wProfile.unclaimed_sol) + netPot,
                updated_at: new Date().toISOString(),
              })
              .eq('wallet_address', winner.wallet_address);
          }
        }

        await supabase
          .from('rooms')
          .update({ status: 'FINISHED', winner_wallet: winner.wallet_address })
          .eq('id', room_id);

        await supabase.from('activity_feed').insert({
          event_type: 'PVP_WIN',
          username: winner.username || winner.wallet_address.slice(0, 8),
          amount_sol: netPot,
        });

        console.log(`[pvp] winner=${winner.wallet_address} grossPot=${grossPot} netPot=${netPot} fee=${platformFeePvp.toFixed(6)}`);

        // Push: notify winner and losers
        const winnerName = winner.username || winner.wallet_address.slice(0, 8);
        for (const player of allPlayers) {
          if (player.wallet_address === winner.wallet_address) {
            notifyWallet(
              player.wallet_address,
              'You won the PvP raid!',
              `${netPot.toFixed(4)} SOL is on its way to your wallet. Well played.`,
              '/',
            );
          } else {
            notifyWallet(
              player.wallet_address,
              'PvP result: you lost',
              `${winnerName} beat you this round. Come back and settle it.`,
              '/',
            );
          }
        }

        pvpPayload = {
          pvp_resolved: true,
          winner_wallet: winner.wallet_address,
          winner_name: winner.username || winner.wallet_address.slice(0, 8),
          pot_sol: netPot,
          gross_pot_sol: grossPot,
          currency: room?.stake_currency ?? 'SOL',
          is_winner: winner.wallet_address === wallet_address,
        };
      } else {
        pvpPayload = { pvp_resolved: false };
      }
    }

    // ── 6b. PVP_WIN achievement (after pvpPayload resolved) ───────────
    if (!isDrill && room_id && (pvpPayload as Record<string, unknown>).is_winner) {
      await supabase
        .from('achievements')
        .upsert(
          [{ wallet_address, achievement_id: 'PVP_WIN' }],
          { onConflict: 'wallet_address,achievement_id', ignoreDuplicates: true },
        );
      if (!newAchievements.includes('PVP_WIN')) newAchievements.push('PVP_WIN');
    }

    // ── 7. Return result + revealed seed ──────────────────────────────
    return json({
      success: true,
      raid_id: raidId,
      sr_earned: totalSREarned,
      new_sr_points: newSRPoints,
      new_unclaimed: newUnclaimed,
      daily_streak: isDrill ? (profile.daily_streak ?? 0) : newStreak,
      new_achievements: newAchievements,
      bounty_awarded: bountyAwarded,
      bounty_id: bountyId,
      insurance_refund: insuranceRefund,
      server_seed: seedData.server_seed,
      server_seed_hash: seedData.server_seed_hash,
      ...(flagged ? { anti_cheat_flag: reason } : {}),
      ...pvpPayload,
    }, 200, corsH);

  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * finalize-round — Atomically determine and record round winners per tier.
 *
 * Must be called after the round ends. Idempotent — if a tier is already
 * finalized, its existing winner data is returned without re-computing.
 *
 * POST body:
 *   { round_number: number, round_date: string }
 *
 * Logic (repeated for each tier GRUNT | ELITE | WHALE):
 *  1. Validate round has ended.
 *  2. Check round_finalizations(round_number, round_date, raid_tier) — idempotent guard.
 *  3. Compute pool (90% of all entry fees for this tier's raids in round window).
 *  4. Find top-5 wallets by best points score (deduplicated per wallet).
 *  5. INSERT all winners into round_winners with claimed=false.
 *  6. INSERT into round_finalizations.
 *  7. Return the finalized winners for all tiers.
 */

const POOL_PCT  = 0.90;
const ALL_TIERS = ['GRUNT', 'ELITE', 'WHALE'] as const;

/**
 * Prize allocation per tier — fractions of pool for ranks 1–5.
 * GRUNT: flatter split for casual play.
 * ELITE: standard competitive weighting.
 * WHALE: winner-takes-most for high-stakes play.
 */
const TIER_ALLOCATION: Record<typeof ALL_TIERS[number], number[]> = {
  GRUNT: [0.38, 0.24, 0.18, 0.12, 0.08],
  ELITE: [0.43, 0.25, 0.17, 0.10, 0.05],
  WHALE: [0.55, 0.23, 0.13, 0.06, 0.03],
};

/** Minimum unique competing wallets for a round to be finalised.
 *  Rounds below this threshold → all entry fees refunded to participants. */
const MIN_PARTICIPANTS = 3;

function getRoundWindow(roundNumber: number, roundDate: string): { start: Date; end: Date } {
  const [y, m, d] = roundDate.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, (roundNumber - 1) * 6));
  const end   = new Date(Date.UTC(y, m - 1, d, roundNumber * 6));
  return { start, end };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { round_number, round_date } = await req.json();

    if (!round_number || !round_date) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: round_number, round_date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (round_number < 1 || round_number > 4) {
      return new Response(
        JSON.stringify({ error: 'round_number must be 1–4' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(round_date)) {
      return new Response(
        JSON.stringify({ error: 'round_date must be YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { start, end } = getRoundWindow(round_number, round_date);
    const now = new Date();

    if (end > now) {
      return new Response(
        JSON.stringify({ error: 'Round has not ended yet.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results: Record<string, unknown> = {};

    // ── Finalize each tier independently ────────────────────────────────────
    for (const tier of ALL_TIERS) {

      // Idempotency check
      const { data: existing } = await supabaseAdmin
        .from('round_finalizations')
        .select('pool_sol')
        .eq('round_number', round_number)
        .eq('round_date', round_date)
        .eq('raid_tier', tier)
        .maybeSingle();

      if (existing) {
        const { data: existingWinners } = await supabaseAdmin
          .from('round_winners')
          .select('*')
          .eq('round_number', round_number)
          .eq('round_date', round_date)
          .eq('raid_tier', tier)
          .order('rank');
        results[tier] = { already_finalized: true, pool_sol: existing.pool_sol, winners: existingWinners ?? [] };
        continue;
      }

      // Fetch all raids for this tier in the round window (successful for ranking, all for fees)
      const [successRes, allRes] = await Promise.all([
        supabaseAdmin
          .from('raid_history')
          .select('wallet_address, points')
          .eq('success', true)
          .eq('raid_tier', tier)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
          .order('points', { ascending: false })
          .limit(500),
        supabaseAdmin
          .from('raid_history')
          .select('wallet_address, entry_fee')
          .eq('raid_tier', tier)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString()),
      ]);

      // Sum fees per wallet (for potential refund) and total pool
      const feesByWallet = new Map<string, number>();
      for (const r of allRes.data ?? []) {
        feesByWallet.set(r.wallet_address, (feesByWallet.get(r.wallet_address) ?? 0) + Number(r.entry_fee));
      }
      const totalFees = [...feesByWallet.values()].reduce((s, v) => s + v, 0);
      const poolSol   = totalFees * POOL_PCT;

      // Deduplicate: best points per wallet
      const bestByWallet = new Map<string, number>();
      for (const r of successRes.data ?? []) {
        const pts = Number(r.points);
        if (pts > (bestByWallet.get(r.wallet_address) ?? 0)) {
          bestByWallet.set(r.wallet_address, pts);
        }
      }

      const sorted = [...bestByWallet.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Unique entrants (even those who never extracted successfully)
      const uniqueEntrants = feesByWallet.size;

      // ── REFUND PATH: fewer participants than minimum threshold ─────────────
      if (uniqueEntrants < MIN_PARTICIPANTS) {
        console.log(`[finalize-round] Round ${round_number}/${round_date} tier=${tier} REFUND — only ${uniqueEntrants} participant(s) (min ${MIN_PARTICIPANTS})`);

        // Insert finalization record with refunded=true (race guard)
        const { error: refundFinalizeErr } = await supabaseAdmin
          .from('round_finalizations')
          .insert({ round_number, round_date, raid_tier: tier, pool_sol: 0, refunded: true });

        if (refundFinalizeErr && refundFinalizeErr.code !== '23505') {
          throw new Error(`Refund finalization insert failed for tier ${tier}: ${refundFinalizeErr.message}`);
        }

        if (!refundFinalizeErr) {
          // Credit each participant's entry fees back to unclaimed_sol
          for (const [wallet, feeTotal] of feesByWallet.entries()) {
            const { data: p } = await supabaseAdmin
              .from('profiles')
              .select('unclaimed_sol')
              .eq('wallet_address', wallet)
              .single();
            if (p) {
              await supabaseAdmin
                .from('profiles')
                .update({ unclaimed_sol: Number(p.unclaimed_sol) + feeTotal, updated_at: new Date().toISOString() })
                .eq('wallet_address', wallet);
            }
          }
          console.log(`[finalize-round] Refunded ${uniqueEntrants} wallet(s) for tier ${tier}, total: ${totalFees.toFixed(4)} SOL`);
        }

        results[tier] = { refunded: true, participants: uniqueEntrants, total_refunded_sol: totalFees };
        continue;
      }

      // ── WINNER PATH ────────────────────────────────────────────────────────
      const allocation = TIER_ALLOCATION[tier];

      // Insert finalization record first (race condition guard)
      const { error: finalizeErr } = await supabaseAdmin
        .from('round_finalizations')
        .insert({ round_number, round_date, raid_tier: tier, pool_sol: poolSol, refunded: false });

      if (finalizeErr) {
        if (finalizeErr.code === '23505') {
          // Concurrent finalization — return existing
          const { data: existingWinners } = await supabaseAdmin
            .from('round_winners')
            .select('*')
            .eq('round_number', round_number)
            .eq('round_date', round_date)
            .eq('raid_tier', tier)
            .order('rank');
          results[tier] = { already_finalized: true, pool_sol: poolSol, winners: existingWinners ?? [] };
          continue;
        }
        throw new Error(`Finalization insert failed for tier ${tier}: ${finalizeErr.message}`);
      }

      if (sorted.length === 0) {
        results[tier] = { success: true, pool_sol: poolSol, winners: [] };
        continue;
      }

      // Insert all winner rows atomically
      const winnerRows = sorted.map(([wallet, pts], i) => ({
        round_number,
        round_date,
        raid_tier: tier,
        wallet_address: wallet,
        rank: i + 1,
        points_scored: pts,
        sol_extracted: 0,        // legacy column — round now ranks by points
        pool_sol: poolSol,
        sol_allocation: poolSol * allocation[i],
        claimed: false,
      }));

      const { error: winnersErr } = await supabaseAdmin
        .from('round_winners')
        .insert(winnerRows);

      if (winnersErr && winnersErr.code !== '23505') {
        throw new Error(`Failed to insert winners for tier ${tier}: ${winnersErr.message}`);
      }

      console.log(`[finalize-round] Round ${round_number}/${round_date} tier=${tier} Pool: ${poolSol.toFixed(4)} SOL Winners: ${sorted.length} Alloc: ${allocation.slice(0, sorted.length).map(a => `${(a*100).toFixed(0)}%`).join('/')}`);
      results[tier] = { success: true, pool_sol: poolSol, winners: winnerRows };
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[finalize-round]', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

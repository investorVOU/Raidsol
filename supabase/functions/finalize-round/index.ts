import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * finalize-round — Atomically determine and record round winners.
 *
 * Must be called after the round ends. Idempotent — if already finalized,
 * returns existing winner data without re-computing anything.
 *
 * POST body:
 *   { round_number: number, round_date: string }
 *
 * Logic:
 *  1. Validate round has ended.
 *  2. Check round_finalizations — if exists, return existing data (idempotent).
 *  3. Compute pool (70% of all entry fees in round window).
 *  4. Find top-5 wallets by best sol_amount (deduplicated per wallet).
 *  5. INSERT all winners into round_winners with claimed=false.
 *  6. INSERT into round_finalizations.
 *  7. Return the finalized winners.
 */

const POOL_PCT  = 0.70;
const ALLOCATION = [0.40, 0.25, 0.18, 0.11, 0.06]; // fractions of pool, sum = 1.00

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

    // ── Idempotency: already finalized? ─────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('round_finalizations')
      .select('pool_sol')
      .eq('round_number', round_number)
      .eq('round_date', round_date)
      .maybeSingle();

    if (existing) {
      const { data: existingWinners } = await supabaseAdmin
        .from('round_winners')
        .select('*')
        .eq('round_number', round_number)
        .eq('round_date', round_date)
        .order('rank');

      return new Response(
        JSON.stringify({ already_finalized: true, pool_sol: existing.pool_sol, winners: existingWinners ?? [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Compute pool and top-5 by points ────────────────────────────────────
    const [successRes, allRes] = await Promise.all([
      supabaseAdmin
        .from('raid_history')
        .select('wallet_address, points')
        .eq('success', true)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('points', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('raid_history')
        .select('entry_fee')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString()),
    ]);

    const totalFees = (allRes.data ?? []).reduce(
      (sum: number, r: { entry_fee: string }) => sum + Number(r.entry_fee), 0
    );
    const poolSol = totalFees * POOL_PCT;

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

    // ── Insert finalization record first (race condition guard) ──────────────
    const { error: finalizeErr } = await supabaseAdmin
      .from('round_finalizations')
      .insert({ round_number, round_date, pool_sol: poolSol });

    if (finalizeErr) {
      if (finalizeErr.code === '23505') {
        // Concurrent finalization — return existing
        const { data: existingWinners } = await supabaseAdmin
          .from('round_winners')
          .select('*')
          .eq('round_number', round_number)
          .eq('round_date', round_date)
          .order('rank');
        return new Response(
          JSON.stringify({ already_finalized: true, pool_sol: poolSol, winners: existingWinners ?? [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Finalization insert failed: ${finalizeErr.message}`);
    }

    if (sorted.length === 0) {
      return new Response(
        JSON.stringify({ success: true, pool_sol: poolSol, winners: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Insert all winner rows atomically ────────────────────────────────────
    const winnerRows = sorted.map(([wallet, pts], i) => ({
      round_number,
      round_date,
      wallet_address: wallet,
      rank: i + 1,
      points_scored: pts,
      sol_extracted: 0,        // legacy column — round now ranks by points, not SOL
      pool_sol: poolSol,
      sol_allocation: poolSol * ALLOCATION[i],
      claimed: false,
    }));

    const { error: winnersErr } = await supabaseAdmin
      .from('round_winners')
      .insert(winnerRows);

    if (winnersErr && winnersErr.code !== '23505') {
      throw new Error(`Failed to insert winners: ${winnersErr.message}`);
    }

    console.log(`[finalize-round] Round ${round_number} / ${round_date} finalized. Pool: ${poolSol.toFixed(4)} SOL. Winners: ${sorted.length}`);

    return new Response(
      JSON.stringify({ success: true, pool_sol: poolSol, winners: winnerRows }),
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

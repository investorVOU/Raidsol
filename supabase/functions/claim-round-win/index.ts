import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * claim-round-win — Round Competition Claim
 *
 * POST body:
 *   { round_number: number, round_date: string, wallet_address: string }
 *
 * Logic:
 *  1. Validate the round has ended (end_time < now).
 *  2. Compute pool (8% of all entry fees in round window).
 *  3. Find top-5 extractors for that round from raid_history.
 *  4. Verify the wallet is in top 5.
 *  5. Check not already claimed (UNIQUE constraint also protects this).
 *  6. Insert round_winners row and credit unclaimed_sol on the profile.
 */

const POOL_PCT = 0.70;
const ALLOCATION = [0.40, 0.25, 0.18, 0.11, 0.06];

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
    const { round_number, round_date, wallet_address } = await req.json();

    // ── Basic validation ────────────────────────────────────────────────────
    if (!round_number || !round_date || !wallet_address) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: round_number, round_date, wallet_address' }),
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

    // ── Round must have ended ───────────────────────────────────────────────
    if (end > now) {
      return new Response(
        JSON.stringify({ error: 'Round has not ended yet. Claims open after round closes.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Check for existing claim ────────────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('round_winners')
      .select('id, claimed, sol_allocation')
      .eq('round_number', round_number)
      .eq('round_date', round_date)
      .eq('wallet_address', wallet_address)
      .maybeSingle();

    if (existing?.claimed) {
      return new Response(
        JSON.stringify({ error: 'Already claimed for this round.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Fetch all raids in round window ─────────────────────────────────────
    const [successRes, allRes] = await Promise.all([
      supabaseAdmin
        .from('raid_history')
        .select('wallet_address, sol_amount, created_at')
        .eq('success', true)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('sol_amount', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('raid_history')
        .select('entry_fee')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString()),
    ]);

    const poolSol = ((allRes.data ?? []).reduce(
      (sum: number, r: { entry_fee: string }) => sum + Number(r.entry_fee), 0
    )) * POOL_PCT;

    // Deduplicate: best sol per wallet (earlier raid wins tiebreak via order)
    const bestByWallet = new Map<string, number>();
    for (const r of successRes.data ?? []) {
      const sol = Number(r.sol_amount);
      const best = bestByWallet.get(r.wallet_address) ?? 0;
      if (sol > best) bestByWallet.set(r.wallet_address, sol);
    }

    const sorted = [...bestByWallet.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // ── Check if wallet is in top 5 ─────────────────────────────────────────
    const rankIndex = sorted.findIndex(([w]) => w === wallet_address);
    if (rankIndex === -1) {
      return new Response(
        JSON.stringify({ error: 'Wallet is not in the top 5 for this round.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rank = rankIndex + 1;
    const solExtracted = sorted[rankIndex][1];
    const solAllocation = poolSol * ALLOCATION[rankIndex];

    // ── If row already exists (unclaimed), just mark as claimed ─────────────
    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from('round_winners')
        .update({ claimed: true, claimed_at: now.toISOString() })
        .eq('id', existing.id);
      if (updateErr) throw new Error(`Update claim failed: ${updateErr.message}`);

      // Credit unclaimed_sol
      const { error: profileErr } = await supabaseAdmin.rpc('increment_unclaimed_sol', {
        p_wallet: wallet_address,
        p_amount: Number(existing.sol_allocation),
      });
      // Fallback if rpc doesn't exist: manual update
      if (profileErr) {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('unclaimed_sol')
          .eq('wallet_address', wallet_address)
          .single();
        await supabaseAdmin
          .from('profiles')
          .update({ unclaimed_sol: Number(prof?.unclaimed_sol ?? 0) + Number(existing.sol_allocation) })
          .eq('wallet_address', wallet_address);
      }

      return new Response(
        JSON.stringify({ success: true, rank, sol_allocation: Number(existing.sol_allocation), pool_sol: poolSol }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Insert new round_winners row ─────────────────────────────────────────
    const { error: insertErr } = await supabaseAdmin
      .from('round_winners')
      .insert({
        round_number: round_number,
        round_date: round_date,
        wallet_address: wallet_address,
        rank: rank,
        sol_extracted: solExtracted,
        pool_sol: poolSol,
        sol_allocation: solAllocation,
        claimed: true,
        claimed_at: now.toISOString(),
      });

    if (insertErr) {
      // UNIQUE constraint violation = already claimed by concurrent request
      if (insertErr.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Already claimed for this round.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Insert failed: ${insertErr.message}`);
    }

    // ── Credit unclaimed_sol on profile ─────────────────────────────────────
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('unclaimed_sol')
      .eq('wallet_address', wallet_address)
      .single();

    await supabaseAdmin
      .from('profiles')
      .update({
        unclaimed_sol: Number(prof?.unclaimed_sol ?? 0) + solAllocation,
      })
      .eq('wallet_address', wallet_address);

    return new Response(
      JSON.stringify({ success: true, rank, sol_allocation: solAllocation, pool_sol: poolSol }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[claim-round-win]', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

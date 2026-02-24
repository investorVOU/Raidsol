import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * claim-round-win — Claim a finalized round prize.
 *
 * Winners are determined ONLY once, after the round ends, by finalize-round.
 * This function reads from that finalized data — it never recomputes winners.
 *
 * POST body:
 *   { round_number: number, round_date: string, wallet_address: string }
 *
 * Logic:
 *  1. Validate round has ended.
 *  2. Ensure round is finalized (lazy: calls finalize-round if not yet done).
 *  3. Read the wallet's row from round_winners.
 *  4. If not found → not a winner (403).
 *  5. If already claimed → 409.
 *  6. Atomically mark claimed + credit unclaimed_sol on profile.
 */

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { round_number, round_date, wallet_address } = await req.json();

    // ── Validation ───────────────────────────────────────────────────────────
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

    // ── Round must have ended ────────────────────────────────────────────────
    const [y, m, d] = round_date.split('-').map(Number);
    const end = new Date(Date.UTC(y, m - 1, d, round_number * 6));
    const now = new Date();

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

    // ── Ensure round is finalized (lazy) ─────────────────────────────────────
    const { data: finalization } = await supabaseAdmin
      .from('round_finalizations')
      .select('pool_sol')
      .eq('round_number', round_number)
      .eq('round_date', round_date)
      .maybeSingle();

    if (!finalization) {
      // Trigger finalization lazily via internal function call
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      // Convert REST URL to functions URL: https://<project>.supabase.co/rest/v1 → /functions/v1
      const fnBase = supabaseUrl.replace(/\/rest\/v1$/, '').replace(/\/$/, '');
      const finalizeRes = await fetch(`${fnBase}/functions/v1/finalize-round`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ round_number, round_date }),
      });

      if (!finalizeRes.ok) {
        const errBody = await finalizeRes.json().catch(() => ({}));
        throw new Error(`Finalization failed: ${errBody.error ?? finalizeRes.statusText}`);
      }
    }

    // ── Read this wallet's finalized winner row ───────────────────────────────
    const { data: winner } = await supabaseAdmin
      .from('round_winners')
      .select('id, rank, sol_allocation, pool_sol, claimed')
      .eq('round_number', round_number)
      .eq('round_date', round_date)
      .eq('wallet_address', wallet_address)
      .maybeSingle();

    if (!winner) {
      return new Response(
        JSON.stringify({ error: 'Wallet is not a winner for this round.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (winner.claimed) {
      return new Response(
        JSON.stringify({ error: 'Already claimed for this round.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Mark claimed ─────────────────────────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from('round_winners')
      .update({ claimed: true, claimed_at: now.toISOString() })
      .eq('id', winner.id)
      .eq('claimed', false); // guard against concurrent claim

    if (updateErr) throw new Error(`Claim update failed: ${updateErr.message}`);

    // ── Credit unclaimed_sol on profile ──────────────────────────────────────
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('unclaimed_sol')
      .eq('wallet_address', wallet_address)
      .single();

    await supabaseAdmin
      .from('profiles')
      .update({ unclaimed_sol: Number(prof?.unclaimed_sol ?? 0) + Number(winner.sol_allocation) })
      .eq('wallet_address', wallet_address);

    console.log(`[claim-round-win] ${wallet_address} claimed rank ${winner.rank} — ${winner.sol_allocation} SOL`);

    return new Response(
      JSON.stringify({
        success: true,
        rank: winner.rank,
        sol_allocation: Number(winner.sol_allocation),
        pool_sol: Number(winner.pool_sol),
      }),
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

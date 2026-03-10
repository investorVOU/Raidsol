import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * claim-round-refund — Claim a refund for a cancelled round.
 *
 * POST body:
 *   { round_number: number, round_date: string, raid_tier: string, wallet_address: string }
 */

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { round_number, round_date, raid_tier, wallet_address } = await req.json();

    if (!round_number || !round_date || !raid_tier || !wallet_address) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: round_number, round_date, raid_tier, wallet_address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (round_number < 1 || round_number > 4) {
      return new Response(
        JSON.stringify({ error: 'round_number must be 1-4' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/^(GRUNT|ELITE|WHALE)$/.test(String(raid_tier))) {
      return new Response(
        JSON.stringify({ error: 'raid_tier must be GRUNT, ELITE, or WHALE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(round_date)) {
      return new Response(
        JSON.stringify({ error: 'round_date must be YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Round must have ended
    const [y, m, d] = round_date.split('-').map(Number);
    const end = new Date(Date.UTC(y, m - 1, d, round_number * 6));
    const now = new Date();
    if (end > now) {
      return new Response(
        JSON.stringify({ error: 'Round has not ended yet. Refunds open after round closes.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Ensure round is finalized (lazy)
    const { data: finalization } = await supabaseAdmin
      .from('round_finalizations')
      .select('refunded')
      .eq('round_number', round_number)
      .eq('round_date', round_date)
      .eq('raid_tier', raid_tier)
      .maybeSingle();

    if (!finalization) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
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

    const { data: finalRow } = await supabaseAdmin
      .from('round_finalizations')
      .select('refunded')
      .eq('round_number', round_number)
      .eq('round_date', round_date)
      .eq('raid_tier', raid_tier)
      .maybeSingle();

    if (!finalRow?.refunded) {
      return new Response(
        JSON.stringify({ error: 'Round is not refundable.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabaseAdmin.rpc('claim_round_refund', {
      p_round_number: round_number,
      p_round_date: round_date,
      p_raid_tier: raid_tier,
      p_wallet: wallet_address,
    });

    if (error) throw new Error(`Refund claim failed: ${error.message}`);

    const result = Array.isArray(data) ? data[0] : data;
    const status = result?.status as string | undefined;
    const amount = Number(result?.amount_sol ?? 0);

    if (status === 'ALREADY_CLAIMED') {
      return new Response(
        JSON.stringify({ error: 'Already claimed for this round.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (status === 'NOT_REFUNDED') {
      return new Response(
        JSON.stringify({ error: 'Round is not refundable.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (status === 'NO_REFUND') {
      return new Response(
        JSON.stringify({ error: 'No refundable entry fees found for this round.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (status !== 'CLAIMED') {
      return new Response(
        JSON.stringify({ error: 'Refund claim failed.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, amount_sol: amount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[claim-round-refund]', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

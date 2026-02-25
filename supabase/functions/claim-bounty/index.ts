import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const json = (body: object, status = 200, corsH: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsH });

  try {
    const { wallet_address, bounty_id } = await req.json();

    if (!wallet_address || !bounty_id) {
      return json({ error: 'wallet_address and bounty_id required' }, 400, corsH);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Fetch bounty ──────────────────────────────────────────────────────
    const { data: bounty, error: bountyErr } = await supabase
      .from('bounties')
      .select('*')
      .eq('id', bounty_id)
      .single();

    if (bountyErr || !bounty) {
      return json({ error: 'Bounty not found' }, 404, corsH);
    }
    if (bounty.status !== 'OPEN') {
      return json({ error: bounty.status === 'CLAIMED' ? 'Bounty already claimed' : 'Bounty is no longer available' }, 409, corsH);
    }
    if (new Date(bounty.expires_at) < new Date()) {
      // Auto-cancel and refund poster
      await supabase.from('bounties').update({ status: 'CANCELLED' }).eq('id', bounty_id);
      const { data: poster } = await supabase
        .from('profiles')
        .select('unclaimed_sol, sr_points')
        .eq('wallet_address', bounty.poster_wallet)
        .single();
      if (poster) {
        if (bounty.reward_type === 'SOL') {
          await supabase.from('profiles').update({
            unclaimed_sol: Number(poster.unclaimed_sol) + Number(bounty.reward_amount),
            updated_at: new Date().toISOString(),
          }).eq('wallet_address', bounty.poster_wallet);
        } else {
          await supabase.from('profiles').update({
            sr_points:  Number(poster.sr_points) + Math.floor(bounty.reward_amount),
            updated_at: new Date().toISOString(),
          }).eq('wallet_address', bounty.poster_wallet);
        }
      }
      return json({ error: 'Bounty has expired — reward refunded to poster' }, 410, corsH);
    }
    if (bounty.poster_wallet === wallet_address) {
      return json({ error: 'Cannot claim your own bounty' }, 403, corsH);
    }

    // ── Find qualifying raid ──────────────────────────────────────────────
    // Must: correct difficulty, points >= target, success=true, after bounty was created
    // And the raid_id must not have already claimed a different bounty
    const { data: qualifyingRaids } = await supabase
      .from('raid_history')
      .select('raid_id, points, difficulty, created_at')
      .eq('wallet_address', wallet_address)
      .eq('difficulty', bounty.difficulty)
      .eq('success', true)
      .gte('points', bounty.target_points)
      .gte('created_at', bounty.created_at)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!qualifyingRaids || qualifyingRaids.length === 0) {
      return json({ error: `No qualifying raid found. Complete a successful ${bounty.difficulty} raid with ${bounty.target_points}+ points after the bounty was posted.` }, 422, corsH);
    }

    // Filter out raid_ids already used for a different bounty claim
    const raidIds = qualifyingRaids.map((r: { raid_id: string }) => r.raid_id);
    const { data: usedRaids } = await supabase
      .from('bounties')
      .select('claimed_raid_id')
      .in('claimed_raid_id', raidIds)
      .eq('status', 'CLAIMED');

    const usedSet = new Set((usedRaids ?? []).map((r: { claimed_raid_id: string }) => r.claimed_raid_id));
    const freshRaid = qualifyingRaids.find((r: { raid_id: string }) => !usedSet.has(r.raid_id));

    if (!freshRaid) {
      return json({ error: 'All qualifying raids have already been used to claim another bounty.' }, 422, corsH);
    }

    // ── Fetch claimer profile ─────────────────────────────────────────────
    const { data: claimer } = await supabase
      .from('profiles')
      .select('username, unclaimed_sol, sr_points')
      .eq('wallet_address', wallet_address)
      .single();

    if (!claimer) {
      return json({ error: 'Claimer profile not found' }, 404, corsH);
    }

    // ── Mark bounty claimed ───────────────────────────────────────────────
    await supabase.from('bounties').update({
      status:              'CLAIMED',
      claimed_by_wallet:   wallet_address,
      claimed_by_username: claimer.username ?? wallet_address.slice(0, 8),
      claimed_raid_id:     freshRaid.raid_id,
      claimed_at:          new Date().toISOString(),
    }).eq('id', bounty_id);

    // ── Credit reward to claimer ──────────────────────────────────────────
    if (bounty.reward_type === 'SOL') {
      await supabase.from('profiles').update({
        unclaimed_sol: Number(claimer.unclaimed_sol) + Number(bounty.reward_amount),
        updated_at:    new Date().toISOString(),
      }).eq('wallet_address', wallet_address);
    } else {
      await supabase.from('profiles').update({
        sr_points:  Number(claimer.sr_points) + Math.floor(bounty.reward_amount),
        updated_at: new Date().toISOString(),
      }).eq('wallet_address', wallet_address);
    }

    // ── Activity feed ─────────────────────────────────────────────────────
    await supabase.from('activity_feed').insert({
      event_type: 'BOUNTY_CLAIMED',
      username:   claimer.username ?? wallet_address.slice(0, 8),
      amount_sol: bounty.reward_type === 'SOL' ? Number(bounty.reward_amount) : 0,
    });

    console.log(`[bounty] claimed bounty=${bounty_id} by=${wallet_address} reward=${bounty.reward_amount}${bounty.reward_type}`);

    return json({
      success:       true,
      reward_type:   bounty.reward_type,
      reward_amount: Number(bounty.reward_amount),
    }, 200, corsH);

  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

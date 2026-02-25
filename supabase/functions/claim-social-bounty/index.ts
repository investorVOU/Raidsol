import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * claim-social-bounty
 *
 * Honour-system SR rewards for:
 *  A) Daily score challenges — verified against raid_history
 *  B) Social tasks (Follow / Retweet / Like @solraid_app) — honour system,
 *     one-time per wallet per action, user-provided X handle stored for reference.
 *
 * social_claims UNIQUE(wallet_address, action_type) prevents double-claims.
 */

const REWARDS: Record<string, number> = {
  CHALLENGE_EASY:   120,
  CHALLENGE_MEDIUM: 250,
  CHALLENGE_HARD:   500,
  CHALLENGE_DEGEN:  1200,
  FOLLOW:           300,
  RETWEET:          150,
  LIKE:             100,
};

const CHALLENGE_REQ: Record<string, { difficulty: string; min_points: number }> = {
  CHALLENGE_EASY:   { difficulty: 'EASY',   min_points: 800  },
  CHALLENGE_MEDIUM: { difficulty: 'MEDIUM', min_points: 1800 },
  CHALLENGE_HARD:   { difficulty: 'HARD',   min_points: 3000 },
  CHALLENGE_DEGEN:  { difficulty: 'DEGEN',  min_points: 4200 },
};

const json = (body: object, status = 200, corsH: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsH });

  try {
    const { wallet_address, action_type, twitter_handle } = await req.json();

    if (!wallet_address || !action_type) {
      return json({ error: 'wallet_address and action_type required' }, 400, corsH);
    }

    const reward_sr = REWARDS[action_type];
    if (!reward_sr) {
      return json({ error: `Unknown action_type: ${action_type}` }, 400, corsH);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Guard: already claimed ────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('social_claims')
      .select('id')
      .eq('wallet_address', wallet_address)
      .eq('action_type', action_type)
      .maybeSingle();

    if (existing) {
      return json({ error: 'Already claimed this reward' }, 409, corsH);
    }

    // ── Score challenge: verify against raid_history ──────────────────────────
    if (action_type.startsWith('CHALLENGE_')) {
      const req_cfg = CHALLENGE_REQ[action_type];
      if (!req_cfg) return json({ error: 'Unknown challenge' }, 400, corsH);

      const { data: qualifying } = await supabase
        .from('raid_history')
        .select('raid_id')
        .eq('wallet_address', wallet_address)
        .eq('difficulty', req_cfg.difficulty)
        .eq('success', true)
        .gte('points', req_cfg.min_points)
        .limit(1);

      if (!qualifying || qualifying.length === 0) {
        return json({
          error: `No qualifying raid found. Complete a successful ${req_cfg.difficulty} raid scoring ${req_cfg.min_points}+ points first.`,
        }, 422, corsH);
      }
    }

    // ── Social tasks: require X handle provided, honour system ───────────────
    if (['FOLLOW', 'RETWEET', 'LIKE'].includes(action_type)) {
      const handle = (twitter_handle ?? '').replace(/^@/, '').trim();
      if (!handle) {
        return json({ error: 'twitter_handle required' }, 400, corsH);
      }
    }

    // ── Fetch profile ─────────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('sr_points')
      .eq('wallet_address', wallet_address)
      .single();

    if (!profile) return json({ error: 'Profile not found' }, 404, corsH);

    // ── Credit SR ─────────────────────────────────────────────────────────────
    await supabase.from('profiles').update({
      sr_points:  Number(profile.sr_points) + reward_sr,
      updated_at: new Date().toISOString(),
    }).eq('wallet_address', wallet_address);

    // ── Record claim (UNIQUE constraint is the real guard) ────────────────────
    const { error: insertErr } = await supabase.from('social_claims').insert({
      wallet_address,
      action_type,
      twitter_handle: twitter_handle ? String(twitter_handle).replace(/^@/, '').trim() : null,
      reward_sr,
    });

    if (insertErr) {
      // Unique violation means race condition — another request got there first
      if (insertErr.code === '23505') {
        return json({ error: 'Already claimed this reward' }, 409, corsH);
      }
      // Rollback SR credit on unexpected insert failure
      await supabase.from('profiles').update({
        sr_points:  Number(profile.sr_points),
        updated_at: new Date().toISOString(),
      }).eq('wallet_address', wallet_address);
      return json({ error: 'Failed to record claim' }, 500, corsH);
    }

    console.log(`[social-claim] wallet=${wallet_address} action=${action_type} reward=${reward_sr}SR handle=${twitter_handle ?? '-'}`);

    return json({ success: true, reward_sr }, 200, corsH);

  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

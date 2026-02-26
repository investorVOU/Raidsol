import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * claim-social-bounty
 *
 * Honour-system SR rewards for:
 *  A) Daily score challenges (CHALLENGE_*) — verified against raid_history
 *  B) Social tasks (Follow / Retweet / Like / POST_TWEET) — honour system,
 *     one-time per wallet per action, user-provided X handle stored for reference.
 *  C) Pass discount tasks (PASS_DISC_*) — SR bonus for unlocking a store coupon:
 *     - PASS_DISC_20_TWEET  (tweet, honour system, URL required)
 *     - PASS_DISC_20_SCORE  (MEDIUM raid ≥ 2000 pts, raid_history verified)
 *     - PASS_DISC_50_HARD   (HARD raid ≥ 3500 pts, raid_history verified)
 *     - PASS_DISC_50_DEGEN  (any successful DEGEN raid, raid_history verified)
 *
 * social_claims UNIQUE(wallet_address, action_type) prevents double-claims.
 */

const REWARDS: Record<string, number> = {
  CHALLENGE_EASY:      120,
  CHALLENGE_MEDIUM:    250,
  CHALLENGE_HARD:      500,
  CHALLENGE_DEGEN:     1200,
  FOLLOW:              300,
  RETWEET:             150,
  LIKE:                100,
  POST_TWEET:          250,
  // Pass discount tasks (SR bonus for unlocking a store coupon)
  PASS_DISC_20_TWEET:  100,
  PASS_DISC_20_SCORE:  150,
  PASS_DISC_50_HARD:   400,
  PASS_DISC_50_DEGEN:  800,
};

const CHALLENGE_REQ: Record<string, { difficulty: string; min_points: number }> = {
  CHALLENGE_EASY:      { difficulty: 'EASY',   min_points: 800  },
  CHALLENGE_MEDIUM:    { difficulty: 'MEDIUM', min_points: 1800 },
  CHALLENGE_HARD:      { difficulty: 'HARD',   min_points: 3000 },
  CHALLENGE_DEGEN:     { difficulty: 'DEGEN',  min_points: 4200 },
  // Pass discount score tasks — same raid_history verification path
  PASS_DISC_20_SCORE:  { difficulty: 'MEDIUM', min_points: 2000 },
  PASS_DISC_50_HARD:   { difficulty: 'HARD',   min_points: 3500 },
  PASS_DISC_50_DEGEN:  { difficulty: 'DEGEN',  min_points: 1    },
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
    const { wallet_address, action_type, twitter_handle, tweet_url } = await req.json();

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
    // Covers CHALLENGE_* and score-based PASS_DISC_* tasks
    if (action_type.startsWith('CHALLENGE_') || action_type in CHALLENGE_REQ) {
      const req_cfg = CHALLENGE_REQ[action_type];
      if (!req_cfg) return json({ error: 'Unknown challenge' }, 400, corsH);

      const { data: qualifying, error: queryErr } = await supabase
        .from('raid_history')
        .select('raid_id')
        .eq('wallet_address', wallet_address)
        .eq('difficulty', req_cfg.difficulty)
        .eq('success', true)
        .gte('points', req_cfg.min_points)
        .limit(1);

      if (queryErr) {
        console.error('[social-claim] raid_history query error:', queryErr);
        return json({ error: 'Failed to verify raid history' }, 500, corsH);
      }

      if (!qualifying || qualifying.length === 0) {
        return json({
          error: `No qualifying raid found. Complete a successful ${req_cfg.difficulty} raid scoring ${req_cfg.min_points}+ points first.`,
        }, 422, corsH);
      }
    }

    // ── Social tasks: require X handle ───────────────────────────────────────
    if (['FOLLOW', 'RETWEET', 'LIKE', 'POST_TWEET', 'PASS_DISC_20_TWEET'].includes(action_type)) {
      const handle = (twitter_handle ?? '').replace(/^@/, '').trim();
      if (!handle) {
        return json({ error: 'twitter_handle required' }, 400, corsH);
      }

      // POST_TWEET + PASS_DISC_20_TWEET: also require a tweet URL (x.com or twitter.com)
      if (action_type === 'POST_TWEET' || action_type === 'PASS_DISC_20_TWEET') {
        const url = (tweet_url ?? '').trim();
        if (!url || !/(twitter\.com|x\.com)\//.test(url)) {
          return json({ error: 'Valid tweet URL required (twitter.com or x.com link)' }, 400, corsH);
        }
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
    const claimHandle = twitter_handle ? String(twitter_handle).replace(/^@/, '').trim() : null;
    // For POST_TWEET / PASS_DISC_20_TWEET store tweet URL alongside handle
    const storedHandle = (action_type === 'POST_TWEET' || action_type === 'PASS_DISC_20_TWEET') && tweet_url
      ? `${claimHandle ?? ''}|${tweet_url.trim()}`
      : claimHandle;

    const { error: insertErr } = await supabase.from('social_claims').insert({
      wallet_address,
      action_type,
      twitter_handle: storedHandle,
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

    console.log(`[social-claim] wallet=${wallet_address} action=${action_type} reward=${reward_sr}SR handle=${twitter_handle ?? '-'} url=${tweet_url ?? '-'}`);

    return json({ success: true, reward_sr }, 200, corsH);

  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

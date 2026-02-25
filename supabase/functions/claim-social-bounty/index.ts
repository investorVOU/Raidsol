import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * claim-social-bounty
 *
 * Handles two categories of one-time SR rewards:
 *  A) Daily score challenges — verified against raid_history
 *  B) Social tasks — Follow / Retweet / Like @solraid_app
 *     Retweet is verified via X API v2 (requires TWITTER_BEARER_TOKEN secret).
 *     Follow and Like use honour system (one-time per wallet).
 *
 * Supabase secrets required:
 *   TWITTER_BEARER_TOKEN  — X API v2 app-only bearer token
 *   SOLRAID_TWITTER_ID    — numeric user ID of @solraid_app
 *   SOLRAID_TWEET_ID      — tweet ID for retweet/like verification
 */

// ── SR reward table ────────────────────────────────────────────────────────────
const REWARDS: Record<string, number> = {
  CHALLENGE_EASY:   120,
  CHALLENGE_MEDIUM: 250,
  CHALLENGE_HARD:   500,
  CHALLENGE_DEGEN:  1200,
  FOLLOW:           300,
  RETWEET:          150,
  LIKE:             100,
};

// ── Challenge requirements (min points on the given difficulty) ────────────────
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

// ── X API helpers ──────────────────────────────────────────────────────────────
async function lookupXUserId(handle: string, bearerToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    const data = await res.json();
    return data?.data?.id ?? null;
  } catch {
    return null;
  }
}

async function verifyRetweet(twitterHandle: string, bearerToken: string, tweetId: string): Promise<boolean> {
  try {
    // Paginate retweeters of the target tweet (up to 100 per page, 1 page for typical volume)
    const res = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by?user.fields=username&max_results=100`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    const data = await res.json();
    if (!data?.data) return false;
    const lower = twitterHandle.toLowerCase().replace(/^@/, '');
    return data.data.some((u: { username: string }) => u.username.toLowerCase() === lower);
  } catch {
    return false;
  }
}

async function verifyFollow(twitterHandle: string, bearerToken: string, solraidUserId: string): Promise<boolean> {
  try {
    const userId = await lookupXUserId(twitterHandle, bearerToken);
    if (!userId) return false;
    // Check if @solraid_app appears in the user's following list (first page, 1000 max)
    const res = await fetch(
      `https://api.twitter.com/2/users/${userId}/following?user.fields=username&max_results=1000`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    const data = await res.json();
    if (!data?.data) return false;
    return data.data.some((u: { id: string }) => u.id === solraidUserId);
  } catch {
    return false;
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────
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

    // ── A) Daily score challenge verification ─────────────────────────────────
    if (action_type.startsWith('CHALLENGE_')) {
      const req_config = CHALLENGE_REQ[action_type];
      if (!req_config) return json({ error: 'Unknown challenge' }, 400, corsH);

      const { data: qualifying } = await supabase
        .from('raid_history')
        .select('raid_id')
        .eq('wallet_address', wallet_address)
        .eq('difficulty', req_config.difficulty)
        .eq('success', true)
        .gte('points', req_config.min_points)
        .limit(1);

      if (!qualifying || qualifying.length === 0) {
        return json({
          error: `No qualifying raid found. Complete a successful ${req_config.difficulty} raid with ${req_config.min_points}+ points first.`
        }, 422, corsH);
      }
    }

    // ── B) Social task verification ───────────────────────────────────────────
    if (['FOLLOW', 'RETWEET', 'LIKE'].includes(action_type)) {
      const handle = (twitter_handle ?? '').replace(/^@/, '').trim();
      if (!handle) {
        return json({ error: 'twitter_handle required for social tasks' }, 400, corsH);
      }

      const bearerToken  = Deno.env.get('TWITTER_BEARER_TOKEN') ?? '';
      const solraidId    = Deno.env.get('SOLRAID_TWITTER_ID')   ?? '';
      const tweetId      = Deno.env.get('SOLRAID_TWEET_ID')     ?? '';

      // Only verify if secrets are configured; otherwise use honour system
      if (bearerToken) {
        if (action_type === 'RETWEET' && tweetId) {
          const verified = await verifyRetweet(handle, bearerToken, tweetId);
          if (!verified) {
            return json({ error: 'Retweet not found. Please retweet the pinned post on @solraid_app and try again.' }, 422, corsH);
          }
        }
        if (action_type === 'FOLLOW' && solraidId) {
          const verified = await verifyFollow(handle, bearerToken, solraidId);
          if (!verified) {
            return json({ error: 'Follow not found. Please follow @solraid_app on X and try again.' }, 422, corsH);
          }
        }
        // LIKE: X API free tier does not expose liked_tweets for app-only auth → honour system
      }
    }

    // ── Fetch + update profile ────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('sr_points')
      .eq('wallet_address', wallet_address)
      .single();

    if (!profile) return json({ error: 'Profile not found' }, 404, corsH);

    await supabase.from('profiles').update({
      sr_points:  Number(profile.sr_points) + reward_sr,
      updated_at: new Date().toISOString(),
    }).eq('wallet_address', wallet_address);

    // ── Record claim (idempotency guard) ──────────────────────────────────────
    await supabase.from('social_claims').insert({
      wallet_address,
      action_type,
      twitter_handle: twitter_handle ?? null,
      reward_sr,
    });

    console.log(`[social-claim] wallet=${wallet_address} action=${action_type} reward=${reward_sr}SR`);

    return json({ success: true, reward_sr }, 200, corsH);

  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

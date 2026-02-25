import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const MIN_SOL = 0.001;
const MAX_SOL = 2.0;
const MIN_SR  = 50;
const MAX_SR  = 10000;

const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'DEGEN'];
const VALID_DURATIONS    = [24, 48, 168]; // hours

const json = (body: object, status = 200, corsH: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  const corsH = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsH });

  try {
    const {
      wallet_address,
      difficulty,
      target_points,
      reward_type,
      reward_amount,
      duration_hours = 48,
    } = await req.json();

    if (!wallet_address || !difficulty || !target_points || !reward_type || !reward_amount) {
      return json({ error: 'Missing required fields' }, 400, corsH);
    }

    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return json({ error: 'Invalid difficulty' }, 400, corsH);
    }

    if (!['SOL', 'SR'].includes(reward_type)) {
      return json({ error: 'reward_type must be SOL or SR' }, 400, corsH);
    }

    const amount = Number(reward_amount);
    const points = Number(target_points);

    if (reward_type === 'SOL' && (amount < MIN_SOL || amount > MAX_SOL)) {
      return json({ error: `SOL reward must be ${MIN_SOL}–${MAX_SOL}` }, 400, corsH);
    }
    if (reward_type === 'SR' && (amount < MIN_SR || amount > MAX_SR)) {
      return json({ error: `SR reward must be ${MIN_SR}–${MAX_SR}` }, 400, corsH);
    }
    if (points < 100 || points > 5000) {
      return json({ error: 'target_points must be 100–5000' }, 400, corsH);
    }

    const duration = VALID_DURATIONS.includes(Number(duration_hours))
      ? Number(duration_hours)
      : 48;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Fetch poster profile ──────────────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('username, unclaimed_sol, sr_points')
      .eq('wallet_address', wallet_address)
      .single();

    if (profileErr || !profile) {
      return json({ error: 'Profile not found' }, 404, corsH);
    }

    // ── Guard: poster has enough balance ─────────────────────────────────
    if (reward_type === 'SOL' && Number(profile.unclaimed_sol) < amount) {
      return json({ error: 'Insufficient unclaimed SOL to post bounty' }, 400, corsH);
    }
    if (reward_type === 'SR' && Number(profile.sr_points) < amount) {
      return json({ error: 'Insufficient SR to post bounty' }, 400, corsH);
    }

    // ── Deduct reward from poster ─────────────────────────────────────────
    const updateField = reward_type === 'SOL'
      ? { unclaimed_sol: Number(profile.unclaimed_sol) - amount, updated_at: new Date().toISOString() }
      : { sr_points:     Number(profile.sr_points)     - Math.floor(amount), updated_at: new Date().toISOString() };

    await supabase
      .from('profiles')
      .update(updateField)
      .eq('wallet_address', wallet_address);

    // ── Insert bounty ─────────────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + duration * 3600 * 1000).toISOString();

    const { data: bounty, error: insertErr } = await supabase
      .from('bounties')
      .insert({
        poster_wallet:   wallet_address,
        poster_username: profile.username ?? wallet_address.slice(0, 8),
        difficulty,
        target_points:   points,
        reward_type,
        reward_amount:   amount,
        expires_at:      expiresAt,
      })
      .select()
      .single();

    if (insertErr) {
      // Refund on insert failure
      const refundField = reward_type === 'SOL'
        ? { unclaimed_sol: Number(profile.unclaimed_sol), updated_at: new Date().toISOString() }
        : { sr_points:     Number(profile.sr_points),     updated_at: new Date().toISOString() };
      await supabase.from('profiles').update(refundField).eq('wallet_address', wallet_address);
      return json({ error: 'Failed to post bounty' }, 500, corsH);
    }

    return json({ success: true, bounty_id: bounty.id }, 200, corsH);

  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

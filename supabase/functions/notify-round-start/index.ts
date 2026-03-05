// notify-round-start — called by pg_cron 5 minutes before each 6-hour round.
// Rounds open at 00:00, 06:00, 12:00, 18:00 UTC.
// pg_cron fires at 23:55, 05:55, 11:55, 17:55 UTC.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@solraid.app';
    if (!vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: 'VAPID keys not set' }), { status: 500, headers: cors });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Work out which round is starting in 5 minutes
    const now      = new Date();
    const utcHour  = now.getUTCHours();
    const nextSlot = [0, 6, 12, 18].find(h => h > utcHour) ?? 0; // next 6-hour boundary
    const roundNum = Math.floor(nextSlot / 6) + 1;

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: cors });
    }

    const payload = JSON.stringify({
      title: 'Round opening in 5 minutes',
      body:  `Round ${roundNum} is about to start — deploy now to compete for the prize pool.`,
      url:   '/',
    });

    const stale: string[] = [];
    await Promise.allSettled(
      subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 5 }, // 5-minute TTL — useless after the round starts
          );
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'statusCode' in err &&
              (err.statusCode === 410 || err.statusCode === 404)) {
            stale.push(s.endpoint);
          }
        }
      })
    );

    if (stale.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', stale);
    }

    console.log(`[notify-round-start] round=${roundNum} sent=${subs.length - stale.length}`);
    return new Response(JSON.stringify({ sent: subs.length - stale.length, round: roundNum }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: getCorsHeaders(req) });
  }
});

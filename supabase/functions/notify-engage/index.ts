// notify-engage — two daily engagement push messages.
// Invoke with { message_type: 'MORNING' | 'EVENING' } or let it auto-detect from UTC hour.
//
// Suggested cron schedule (Supabase pg_cron):
//   MORNING  — 09:00 UTC daily  → select net.http_post(url, '{"message_type":"MORNING"}', ...)
//   EVENING  — 18:00 UTC daily  → select net.http_post(url, '{"message_type":"EVENING"}', ...)
//
// Required secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { getCorsHeaders } from '../_shared/cors.ts';

type MessageType = 'MORNING' | 'EVENING';

const MESSAGES: Record<MessageType, { title: string; body: string; url: string }> = {
  MORNING: {
    title: 'Your daily bonus is live',
    body:  'Complete today\'s bounty for SR rewards — then jump into a raid and extract before you bust.',
    url:   '/',
  },
  EVENING: {
    title: 'One more raid before you sleep',
    body:  'Busts refund 50% of your entry fee. Round competitions give a full refund if they don\'t fire.',
    url:   '/',
  },
};

function detectMessageType(): MessageType {
  const hour = new Date().getUTCHours();
  return hour < 14 ? 'MORNING' : 'EVENING';
}

const json = (body: object, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@solraid.app';

    if (!vapidPublic || !vapidPrivate) {
      return json({ error: 'VAPID keys not set' }, 500, cors);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve message type from body or auto-detect
    let messageType: MessageType = detectMessageType();
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.message_type === 'MORNING' || body?.message_type === 'EVENING') {
        messageType = body.message_type;
      }
    } catch { /* ignore — use auto-detect */ }

    const message = MESSAGES[messageType];

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (!subs || subs.length === 0) {
      return json({ sent: 0, message_type: messageType }, 200, cors);
    }

    const payload = JSON.stringify(message);
    const stale: string[] = [];

    await Promise.allSettled(
      subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 8 }, // 8-hour TTL
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

    const sent = subs.length - stale.length;
    console.log(`[notify-engage] type=${messageType} sent=${sent} stale=${stale.length}`);
    return json({ sent, message_type: messageType }, 200, cors);

  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

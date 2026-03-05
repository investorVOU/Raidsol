// send-push — sends a Web Push notification to a wallet's subscribed devices.
// Uses VAPID + web-push (npm:web-push) via Deno npm compatibility.
//
// Required Supabase secrets:
//   VAPID_PUBLIC_KEY   — base64url VAPID public key
//   VAPID_PRIVATE_KEY  — base64url VAPID private key
//   VAPID_SUBJECT      — mailto: or https: URL identifying the sender
//
// Body: { wallet_address: string, title: string, body: string, url?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { getCorsHeaders } from '../_shared/cors.ts';

const json = (body: object, status = 200, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { wallet_address, title, body: msgBody, url = '/' } = await req.json();
    if (!wallet_address || !title) return json({ error: 'wallet_address and title required' }, 400, cors);

    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@solraid.app';

    if (!vapidPublic || !vapidPrivate) return json({ error: 'VAPID keys not configured' }, 500, cors);

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // wallet_address='ALL' → broadcast to every subscribed device
    const query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
    const { data: subs } = wallet_address === 'ALL'
      ? await query
      : await query.eq('wallet_address', wallet_address);

    if (!subs || subs.length === 0) return json({ sent: 0 }, 200, cors);

    const payload = JSON.stringify({ title, body: msgBody ?? '', url });
    const stale: string[] = [];

    await Promise.allSettled(
      subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24 },
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
      console.log(`[send-push] removed ${stale.length} stale subs (broadcast=${wallet_address === 'ALL'})`);
    }

    return json({ sent: subs.length - stale.length }, 200, cors);
  } catch (err) {
    return json({ error: String(err) }, 500, getCorsHeaders(req));
  }
});

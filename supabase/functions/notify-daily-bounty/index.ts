// notify-daily-bounty — called by pg_cron at midnight UTC every day.
// Sends a push notification to all subscribers with today's bounty task.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { getCorsHeaders } from '../_shared/cors.ts';

const DAILY_BOUNTIES = [
  { id: 0, label: 'Clean Exit',   task: 'Extract on any real raid',              reward: 300  },
  { id: 1, label: 'High Roller',  task: 'Extract at 2.0× multiplier or higher',  reward: 500  },
  { id: 2, label: 'Elite Score',  task: 'Score 3,000+ points on a real raid',    reward: 600  },
  { id: 3, label: 'Speed Run',    task: 'Extract in under 35 seconds',           reward: 400  },
  { id: 4, label: 'Hard Target',  task: 'Extract on Hard difficulty',            reward: 700  },
  { id: 5, label: 'Peak Hunter',  task: 'Extract at 3.0× multiplier or higher',  reward: 800  },
  { id: 6, label: 'Degen Run',    task: 'Extract on Degen difficulty',           reward: 1200 },
  { id: 7, label: 'Score Padder', task: 'Score 1,500+ points on a real raid',   reward: 350  },
  { id: 8, label: 'Quick Hands',  task: 'Extract in under 50 seconds',           reward: 300  },
  { id: 9, label: 'Multiplier+',  task: 'Extract at 1.5× multiplier or higher',  reward: 250  },
];

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

    const dayIndex = Math.floor(Date.now() / 86_400_000);
    const bounty   = DAILY_BOUNTIES[dayIndex % DAILY_BOUNTIES.length];

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: cors });
    }

    const payload = JSON.stringify({
      title: `Daily Bounty: ${bounty.label}`,
      body:  `${bounty.task} · earn +${bounty.reward} SR`,
      url:   '/',
    });

    const stale: string[] = [];
    await Promise.allSettled(
      subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 6 }, // 6-hour TTL — expires when next bounty drops
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

    console.log(`[notify-daily-bounty] bounty=${bounty.label} sent=${subs.length - stale.length} stale=${stale.length}`);
    return new Response(JSON.stringify({ sent: subs.length - stale.length, bounty: bounty.label }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: getCorsHeaders(req) });
  }
});

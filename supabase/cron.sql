-- Supabase pg_cron schedule for finalize-round
-- Requires extensions: pg_cron, pg_net
-- Runs at 00:01, 06:01, 12:01, 18:01 UTC (1 minute after each round ends).

create extension if not exists pg_cron;
create extension if not exists pg_net;

drop function if exists public.finalize_round_cron_call();

create or replace function public.finalize_round_cron_call()
returns bigint
language sql
as $$
  select net.http_post(
    'https://ujioyhtyfekfdmmblrdy.supabase.co/functions/v1/finalize-round',
    jsonb_build_object(
      -- Use a 2-minute offset so we never land exactly on the round boundary (e.g., 12:00),
      -- which would incorrectly resolve to the *next* round.
      'round_number', (floor(extract(hour from (now() at time zone 'UTC' - interval '2 minutes')) / 6) + 1)::int,
      'round_date', to_char((now() at time zone 'UTC' - interval '2 minutes'), 'YYYY-MM-DD')
    ),
    null,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4'
    )
  );
$$;

select cron.schedule('finalize_round_0001', '1 0 * * *',  'select public.finalize_round_cron_call();');
select cron.schedule('finalize_round_0601', '1 6 * * *',  'select public.finalize_round_cron_call();');
select cron.schedule('finalize_round_1201', '1 12 * * *', 'select public.finalize_round_cron_call();');
select cron.schedule('finalize_round_1801', '1 18 * * *', 'select public.finalize_round_cron_call();');

-- ─── Push notification cron jobs ──────────────────────────────────────────────
-- Fires 5 minutes before each 6-hour round (00:00, 06:00, 12:00, 18:00 UTC)
create or replace function public.notify_round_start_cron_call()
returns bigint language sql as $$
  select net.http_post(
    'https://ujioyhtyfekfdmmblrdy.supabase.co/functions/v1/notify-round-start',
    '{}',
    null,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4'
    )
  );
$$;

select cron.schedule('notify_round_start_2355', '55 23 * * *', 'select public.notify_round_start_cron_call();');
select cron.schedule('notify_round_start_0555', '55 5 * * *',  'select public.notify_round_start_cron_call();');
select cron.schedule('notify_round_start_1155', '55 11 * * *', 'select public.notify_round_start_cron_call();');
select cron.schedule('notify_round_start_1755', '55 17 * * *', 'select public.notify_round_start_cron_call();');

-- Daily bounty at midnight UTC
create or replace function public.notify_daily_bounty_cron_call()
returns bigint language sql as $$
  select net.http_post(
    'https://ujioyhtyfekfdmmblrdy.supabase.co/functions/v1/notify-daily-bounty',
    '{}',
    null,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4'
    )
  );
$$;

select cron.schedule('notify_daily_bounty', '0 0 * * *', 'select public.notify_daily_bounty_cron_call();');

-- Engagement: 09:00 UTC (morning) and 18:00 UTC (evening)
create or replace function public.notify_engage_morning_cron_call()
returns bigint language sql as $$
  select net.http_post(
    'https://ujioyhtyfekfdmmblrdy.supabase.co/functions/v1/notify-engage',
    '{"message_type":"MORNING"}',
    null,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4'
    )
  );
$$;

create or replace function public.notify_engage_evening_cron_call()
returns bigint language sql as $$
  select net.http_post(
    'https://ujioyhtyfekfdmmblrdy.supabase.co/functions/v1/notify-engage',
    '{"message_type":"EVENING"}',
    null,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaW95aHR5ZmVrZmRtbWJscmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM2OTI3OCwiZXhwIjoyMDg2OTQ1Mjc4fQ.Yyla7-m9Q7s-k72JuJ_Im2pz5s2Y0M78zzsDIj74rk4'
    )
  );
$$;

select cron.schedule('notify_engage_morning', '0 9 * * *',  'select public.notify_engage_morning_cron_call();');
select cron.schedule('notify_engage_evening', '0 18 * * *', 'select public.notify_engage_evening_cron_call();');

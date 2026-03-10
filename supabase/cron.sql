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
      'round_number', (floor(extract(hour from (now() at time zone 'UTC' - interval '1 minute')) / 6) + 1)::int,
      'round_date', to_char((now() at time zone 'UTC' - interval '1 minute'), 'YYYY-MM-DD')
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

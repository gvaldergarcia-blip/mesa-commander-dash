
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing jobs (safe if absent)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN (
    'label-sms-daily-hourly', 'label-sms-expiry-15min'
  );
END $$;

SELECT cron.schedule(
  'label-sms-daily-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://akqldesakmcroydbgkbe.supabase.co/functions/v1/schedule-label-sms-reports',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrcWxkZXNha21jcm95ZGJna2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNzU5MzMsImV4cCI6MjA3MDk1MTkzM30.z9-eadw-xSeHgnqUUO5BMm2vVkabfY3p41Yb9CGPXIM"}'::jsonb,
    body := jsonb_build_object('at', now())
  );
  $$
);

SELECT cron.schedule(
  'label-sms-expiry-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://akqldesakmcroydbgkbe.supabase.co/functions/v1/check-label-expiry-alerts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrcWxkZXNha21jcm95ZGJna2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNzU5MzMsImV4cCI6MjA3MDk1MTkzM30.z9-eadw-xSeHgnqUUO5BMm2vVkabfY3p41Yb9CGPXIM"}'::jsonb,
    body := jsonb_build_object('at', now())
  );
  $$
);

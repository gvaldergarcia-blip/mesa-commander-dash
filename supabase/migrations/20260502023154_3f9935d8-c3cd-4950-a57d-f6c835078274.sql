
SELECT cron.unschedule('social-autopilot-daily-11h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='social-autopilot-daily-11h');

SELECT cron.schedule(
  'social-autopilot-daily-11h',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://akqldesakmcroydbgkbe.supabase.co/functions/v1/social-suggest-daily',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrcWxkZXNha21jcm95ZGJna2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNzU5MzMsImV4cCI6MjA3MDk1MTkzM30.z9-eadw-xSeHgnqUUO5BMm2vVkabfY3p41Yb9CGPXIM"}'::jsonb,
    body := concat('{"trigger":"cron","at":"', now(), '"}')::jsonb
  ) as request_id;
  $$
);

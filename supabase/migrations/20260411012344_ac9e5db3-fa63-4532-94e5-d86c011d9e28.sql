-- Drop old overloads of qr_join_queue
DROP FUNCTION IF EXISTS public.qr_join_queue(uuid, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.qr_join_queue(uuid, text, text, boolean, boolean, text, date, integer);
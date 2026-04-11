-- Drop the old overload without email/birthday params
DROP FUNCTION IF EXISTS public.qr_register_customer(uuid, text, text, boolean, boolean);

-- Ensure the correct version with all optional params exists and anon can call it
GRANT EXECUTE ON FUNCTION public.qr_register_customer(uuid, text, text, boolean, boolean, text, date) TO anon;
GRANT EXECUTE ON FUNCTION public.qr_register_customer(uuid, text, text, boolean, boolean, text, date) TO authenticated;
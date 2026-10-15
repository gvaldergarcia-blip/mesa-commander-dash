REVOKE ALL ON FUNCTION public.label_guard_original_expiry() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.label_guard_original_expiry() TO service_role;
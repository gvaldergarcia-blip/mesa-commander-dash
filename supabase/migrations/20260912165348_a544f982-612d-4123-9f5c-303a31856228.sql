-- Revoke direct execution on trigger functions (triggers run as owner, no user grant needed)
REVOKE EXECUTE ON FUNCTION public.sync_plan_modules_list_to_mesaclik() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_plan_modules_list_to_mesaclik() FROM anon;
REVOKE EXECUTE ON FUNCTION mesaclik.sync_plan_modules_list_to_public() FROM authenticated;
REVOKE EXECUTE ON FUNCTION mesaclik.sync_plan_modules_list_to_public() FROM anon;

-- Keep only service_role for any internal/admin usage
GRANT EXECUTE ON FUNCTION public.sync_plan_modules_list_to_mesaclik() TO service_role;
GRANT EXECUTE ON FUNCTION mesaclik.sync_plan_modules_list_to_public() TO service_role;

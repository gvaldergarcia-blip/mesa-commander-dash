-- Fix: Remove duplicate is_admin() (no-args) function that conflicts with is_admin(uuid DEFAULT auth.uid())
-- The uuid version is used by many RLS policies, so we keep it and drop the no-args duplicate
DROP FUNCTION IF EXISTS public.is_admin();

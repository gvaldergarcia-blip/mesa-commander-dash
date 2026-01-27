
-- The issue is all policies are RESTRICTIVE by default
-- We need at least ONE PERMISSIVE policy for access to work
-- Let's recreate the owner policy as PERMISSIVE

-- First drop all existing policies on restaurant_customers
DROP POLICY IF EXISTS restaurant_customers_admin_access ON public.restaurant_customers;
DROP POLICY IF EXISTS restaurant_customers_owner_only ON public.restaurant_customers;
DROP POLICY IF EXISTS restaurant_customers_panel_access ON public.restaurant_customers;
DROP POLICY IF EXISTS restaurant_customers_full_access ON public.restaurant_customers;

-- Create a single PERMISSIVE policy that grants access to:
-- 1. Admin users (via is_admin())
-- 2. Restaurant owners (via mesaclik.restaurants owner_id check)
CREATE POLICY "restaurant_customers_access"
ON public.restaurant_customers
FOR ALL
TO authenticated
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

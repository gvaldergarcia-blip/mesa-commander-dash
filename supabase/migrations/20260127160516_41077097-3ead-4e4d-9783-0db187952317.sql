-- Add policy for admin access to restaurant_customers
-- This ensures admin users can see all customers

CREATE POLICY "restaurant_customers_admin_access"
ON public.restaurant_customers
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Also add restaurant_customers_owner_only policy that actually works
-- by checking mesaclik.restaurants which has the actual data
DROP POLICY IF EXISTS restaurant_customers_owner_only ON public.restaurant_customers;

CREATE POLICY "restaurant_customers_owner_only"
ON public.restaurant_customers
FOR ALL
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
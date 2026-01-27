-- Fix restaurant_customers RLS policy to allow owner access
-- The current policy checks mesaclik.restaurants.owner_id but needs a permissive SELECT

-- Drop existing policy
DROP POLICY IF EXISTS restaurant_customers_full_access ON public.restaurant_customers;

-- Create new policies that are more permissive for restaurant owners
-- Policy for authenticated users who own the restaurant
CREATE POLICY "restaurant_customers_owner_access"
ON public.restaurant_customers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

-- Also add access via mesaclik.restaurants for the panel
CREATE POLICY "restaurant_customers_panel_access"
ON public.restaurant_customers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
    AND r.owner_id = auth.uid()
  )
);
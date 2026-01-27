-- Add a specific SELECT policy for restaurant_customers
-- The existing ALL policy should cover SELECT, but let's add explicit one for safety

-- First check if we need to add a fallback
-- The issue might be that is_admin() returns false and the join isn't working properly

-- Let's also verify the owner_id value makes sense
-- owner_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208' which is also the restaurant_id

-- Add an explicit SELECT policy that's permissive for authenticated users who are restaurant owners
DROP POLICY IF EXISTS "restaurant_customers_select_owner" ON public.restaurant_customers;

CREATE POLICY "restaurant_customers_select_owner" 
ON public.restaurant_customers 
FOR SELECT 
TO authenticated
USING (
  is_admin() 
  OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_customers.restaurant_id 
    AND r.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM restaurant_members rm
    WHERE rm.restaurant_id = restaurant_customers.restaurant_id
    AND rm.user_id = auth.uid()
  )
);
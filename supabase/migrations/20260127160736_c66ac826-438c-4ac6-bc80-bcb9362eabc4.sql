
-- Remove policy that references empty public.restaurants
DROP POLICY IF EXISTS restaurant_customers_owner_access ON public.restaurant_customers;

-- Now we have only:
-- restaurant_customers_admin_access (is_admin())
-- restaurant_customers_owner_only (mesaclik.restaurants) 
-- restaurant_customers_panel_access (mesaclik.restaurants)
-- These should work correctly

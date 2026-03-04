
-- 1. Create a public-safe view without owner_id
CREATE OR REPLACE VIEW public.restaurants_public
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  cuisine,
  city,
  address_line,
  has_queue,
  has_reservation,
  image_url,
  status,
  approved_at,
  plan_modules,
  created_at,
  updated_at
FROM public.restaurants;

-- 2. Allow anyone to read the safe view
CREATE POLICY "restaurants_public_view_read"
ON public.restaurants
FOR SELECT
TO anon
USING (false);

-- 3. Drop the old public read policies that expose owner_id to anon
DROP POLICY IF EXISTS "restaurants_public_read" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_public_read_approved" ON public.restaurants;

-- 4. Re-create public read for AUTHENTICATED only (they need owner_id for RLS checks)
CREATE POLICY "restaurants_read_authenticated"
ON public.restaurants
FOR SELECT
TO authenticated
USING (true);

-- Add permissive RLS policies for panel to manage settings tables
-- These allow anon/authenticated to manage settings for valid restaurants

-- 1. public.queue_settings - Add INSERT policy for panel
CREATE POLICY "panel_can_insert_queue_settings"
ON public.queue_settings
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = queue_settings.restaurant_id)
);

-- 2. public.queue_settings - Add UPDATE policy for panel
CREATE POLICY "panel_can_update_queue_settings"
ON public.queue_settings
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = queue_settings.restaurant_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = queue_settings.restaurant_id)
);

-- 3. public.reservation_settings - Add INSERT policy for panel
CREATE POLICY "panel_can_insert_reservation_settings"
ON public.reservation_settings
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = reservation_settings.restaurant_id)
);

-- 4. public.reservation_settings - Add UPDATE policy for panel
CREATE POLICY "panel_can_update_reservation_settings"
ON public.reservation_settings
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = reservation_settings.restaurant_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = reservation_settings.restaurant_id)
);

-- 5. public.restaurant_hours - Add INSERT policy for panel
CREATE POLICY "panel_can_insert_restaurant_hours"
ON public.restaurant_hours
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_hours.restaurant_id)
);

-- 6. public.restaurant_hours - Add UPDATE policy for panel  
CREATE POLICY "panel_can_update_restaurant_hours"
ON public.restaurant_hours
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_hours.restaurant_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_hours.restaurant_id)
);

-- 7. public.restaurant_hours - Add DELETE policy for panel
CREATE POLICY "panel_can_delete_restaurant_hours"
ON public.restaurant_hours
FOR DELETE
TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_hours.restaurant_id)
);
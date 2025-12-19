-- Adicionar policy permissiva para INSERT em reservation_settings
-- verificando se o restaurante existe em mesaclik.restaurants
CREATE POLICY "panel_insert_reservation_settings_mesaclik" 
ON public.reservation_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_id
  )
);

-- Adicionar policy permissiva para UPDATE em reservation_settings
CREATE POLICY "panel_update_reservation_settings_mesaclik" 
ON public.reservation_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_id
  )
);

-- Fazer o mesmo para queue_settings
CREATE POLICY "panel_insert_queue_settings_mesaclik" 
ON public.queue_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_id
  )
);

CREATE POLICY "panel_update_queue_settings_mesaclik" 
ON public.queue_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_id
  )
);
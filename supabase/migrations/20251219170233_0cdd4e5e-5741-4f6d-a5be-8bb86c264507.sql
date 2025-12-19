-- Primeiro limpar dados órfãos que não existem em mesaclik.restaurants
DELETE FROM public.queue_settings qs
WHERE NOT EXISTS (SELECT 1 FROM mesaclik.restaurants mr WHERE mr.id = qs.restaurant_id);

DELETE FROM public.reservation_settings rs
WHERE NOT EXISTS (SELECT 1 FROM mesaclik.restaurants mr WHERE mr.id = rs.restaurant_id);

-- Agora remover FK antiga e criar nova apontando para mesaclik.restaurants
ALTER TABLE public.queue_settings
  DROP CONSTRAINT IF EXISTS queue_settings_restaurant_id_fkey;

ALTER TABLE public.queue_settings
  ADD CONSTRAINT queue_settings_restaurant_id_fkey
  FOREIGN KEY (restaurant_id)
  REFERENCES mesaclik.restaurants(id)
  ON DELETE CASCADE;

ALTER TABLE public.reservation_settings
  DROP CONSTRAINT IF EXISTS reservation_settings_restaurant_id_fkey;

ALTER TABLE public.reservation_settings
  ADD CONSTRAINT reservation_settings_restaurant_id_fkey
  FOREIGN KEY (restaurant_id)
  REFERENCES mesaclik.restaurants(id)
  ON DELETE CASCADE;
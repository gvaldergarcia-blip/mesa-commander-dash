-- Fix: mesaclik.queue_settings usa nomes diferentes de colunas (avg_wait_time_* e max_queue_capacity)
-- e o painel precisa salvar sem auth (mesmo padrão do horário).

-- 1) Corrigir função de sync para queue_settings (mesaclik -> public)
CREATE OR REPLACE FUNCTION public.sync_queue_settings_to_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, mesaclik, extensions
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.queue_settings
    WHERE restaurant_id = OLD.restaurant_id;
    RETURN OLD;
  ELSE
    DELETE FROM public.queue_settings
    WHERE restaurant_id = NEW.restaurant_id;

    INSERT INTO public.queue_settings (
      restaurant_id,
      max_party_size,
      queue_capacity,
      avg_time_1_2,
      avg_time_3_4,
      avg_time_5_6,
      avg_time_7_8
    )
    VALUES (
      NEW.restaurant_id,
      COALESCE(NEW.max_party_size, 8),
      COALESCE(NEW.max_queue_capacity, 50),
      COALESCE(NEW.avg_wait_time_1_2, 30),
      COALESCE(NEW.avg_wait_time_3_4, 45),
      COALESCE(NEW.avg_wait_time_5_6, 60),
      COALESCE(NEW.avg_wait_time_7_8, 75)
    );

    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_queue_settings_to_public() FROM PUBLIC;

-- 2) Tornar salvamento do painel possível no schema mesaclik (sem auth)
ALTER TABLE mesaclik.queue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaclik.reservation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS panel_can_manage_queue_settings ON mesaclik.queue_settings;
CREATE POLICY panel_can_manage_queue_settings
ON mesaclik.queue_settings
FOR ALL
TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = queue_settings.restaurant_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = queue_settings.restaurant_id)
);

DROP POLICY IF EXISTS panel_can_manage_reservation_settings ON mesaclik.reservation_settings;
CREATE POLICY panel_can_manage_reservation_settings
ON mesaclik.reservation_settings
FOR ALL
TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = reservation_settings.restaurant_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = reservation_settings.restaurant_id)
);

-- 3) Opcional: reforçar sync da reservation_settings (defaults, evita null indo pro public)
CREATE OR REPLACE FUNCTION public.sync_reservation_settings_to_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, mesaclik, extensions
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.reservation_settings
    WHERE restaurant_id = OLD.restaurant_id;
    RETURN OLD;
  ELSE
    DELETE FROM public.reservation_settings
    WHERE restaurant_id = NEW.restaurant_id;

    INSERT INTO public.reservation_settings (
      restaurant_id, max_party_size, tolerance_minutes
    )
    VALUES (
      NEW.restaurant_id,
      COALESCE(NEW.max_party_size, 8),
      COALESCE(NEW.tolerance_minutes, 15)
    );

    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_reservation_settings_to_public() FROM PUBLIC;
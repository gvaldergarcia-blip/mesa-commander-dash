-- Triggers de sincronização: mesaclik -> public para queue_settings e reservation_settings

-- 1) Função de sync para queue_settings
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
      restaurant_id, max_party_size, queue_capacity,
      avg_time_1_2, avg_time_3_4, avg_time_5_6, avg_time_7_8
    )
    VALUES (
      NEW.restaurant_id, NEW.max_party_size, NEW.queue_capacity,
      NEW.avg_time_1_2, NEW.avg_time_3_4, NEW.avg_time_5_6, NEW.avg_time_7_8
    );

    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_queue_settings_to_public() FROM PUBLIC;

DROP TRIGGER IF EXISTS trigger_sync_queue_settings_to_public ON mesaclik.queue_settings;

CREATE TRIGGER trigger_sync_queue_settings_to_public
AFTER INSERT OR UPDATE OR DELETE ON mesaclik.queue_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_queue_settings_to_public();

-- 2) Função de sync para reservation_settings
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
      NEW.restaurant_id, NEW.max_party_size, NEW.tolerance_minutes
    );

    RETURN NEW;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_reservation_settings_to_public() FROM PUBLIC;

DROP TRIGGER IF EXISTS trigger_sync_reservation_settings_to_public ON mesaclik.reservation_settings;

CREATE TRIGGER trigger_sync_reservation_settings_to_public
AFTER INSERT OR UPDATE OR DELETE ON mesaclik.reservation_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_reservation_settings_to_public();
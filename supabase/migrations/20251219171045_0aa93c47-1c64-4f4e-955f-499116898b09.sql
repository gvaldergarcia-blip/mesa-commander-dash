-- 1) Garantir que a tabela usada pelo app (schema mesaclik) tenha o campo de tolerância
ALTER TABLE mesaclik.queue_settings
  ADD COLUMN IF NOT EXISTS tolerance_minutes integer NOT NULL DEFAULT 10;

-- 2) Backfill: copiar configurações já salvas no dashboard (public) para o schema do app (mesaclik)
INSERT INTO mesaclik.queue_settings (
  restaurant_id,
  max_party_size,
  max_queue_capacity,
  tolerance_minutes,
  avg_wait_time_1_2,
  avg_wait_time_3_4,
  avg_wait_time_5_6,
  avg_wait_time_7_8
)
SELECT
  restaurant_id,
  max_party_size,
  queue_capacity,
  COALESCE(tolerance_minutes, 10),
  avg_time_1_2,
  avg_time_3_4,
  avg_time_5_6,
  avg_time_7_8
FROM public.queue_settings
ON CONFLICT (restaurant_id)
DO UPDATE SET
  max_party_size = EXCLUDED.max_party_size,
  max_queue_capacity = EXCLUDED.max_queue_capacity,
  tolerance_minutes = EXCLUDED.tolerance_minutes,
  avg_wait_time_1_2 = EXCLUDED.avg_wait_time_1_2,
  avg_wait_time_3_4 = EXCLUDED.avg_wait_time_3_4,
  avg_wait_time_5_6 = EXCLUDED.avg_wait_time_5_6,
  avg_wait_time_7_8 = EXCLUDED.avg_wait_time_7_8,
  updated_at = now();

-- 3) Atualizar função existente (mesaclik -> public) para incluir tolerance_minutes
CREATE OR REPLACE FUNCTION public.sync_queue_settings_to_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik', 'extensions'
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
      tolerance_minutes,
      avg_time_1_2,
      avg_time_3_4,
      avg_time_5_6,
      avg_time_7_8
    )
    VALUES (
      NEW.restaurant_id,
      COALESCE(NEW.max_party_size, 8),
      COALESCE(NEW.max_queue_capacity, 50),
      COALESCE(NEW.tolerance_minutes, 10),
      COALESCE(NEW.avg_wait_time_1_2, 30),
      COALESCE(NEW.avg_wait_time_3_4, 45),
      COALESCE(NEW.avg_wait_time_5_6, 60),
      COALESCE(NEW.avg_wait_time_7_8, 75)
    );

    RETURN NEW;
  END IF;
END;
$$;

-- 4) Criar sync do dashboard (public) -> app (mesaclik)
CREATE OR REPLACE FUNCTION public.sync_public_queue_settings_to_mesaclik()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik', 'extensions'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM mesaclik.queue_settings
    WHERE restaurant_id = OLD.restaurant_id;
    RETURN OLD;
  ELSE
    INSERT INTO mesaclik.queue_settings (
      restaurant_id,
      max_party_size,
      max_queue_capacity,
      tolerance_minutes,
      avg_wait_time_1_2,
      avg_wait_time_3_4,
      avg_wait_time_5_6,
      avg_wait_time_7_8,
      updated_at
    )
    VALUES (
      NEW.restaurant_id,
      COALESCE(NEW.max_party_size, 8),
      COALESCE(NEW.queue_capacity, 50),
      COALESCE(NEW.tolerance_minutes, 10),
      COALESCE(NEW.avg_time_1_2, 30),
      COALESCE(NEW.avg_time_3_4, 45),
      COALESCE(NEW.avg_time_5_6, 60),
      COALESCE(NEW.avg_time_7_8, 75),
      now()
    )
    ON CONFLICT (restaurant_id)
    DO UPDATE SET
      max_party_size = EXCLUDED.max_party_size,
      max_queue_capacity = EXCLUDED.max_queue_capacity,
      tolerance_minutes = EXCLUDED.tolerance_minutes,
      avg_wait_time_1_2 = EXCLUDED.avg_wait_time_1_2,
      avg_wait_time_3_4 = EXCLUDED.avg_wait_time_3_4,
      avg_wait_time_5_6 = EXCLUDED.avg_wait_time_5_6,
      avg_wait_time_7_8 = EXCLUDED.avg_wait_time_7_8,
      updated_at = now();

    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_queue_settings_to_mesaclik_ins_upd ON public.queue_settings;
DROP TRIGGER IF EXISTS trg_public_queue_settings_to_mesaclik_del ON public.queue_settings;

CREATE TRIGGER trg_public_queue_settings_to_mesaclik_ins_upd
AFTER INSERT OR UPDATE ON public.queue_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_queue_settings_to_mesaclik();

CREATE TRIGGER trg_public_queue_settings_to_mesaclik_del
AFTER DELETE ON public.queue_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_queue_settings_to_mesaclik();

-- 5) (Bônus necessário) Sync de reservation_settings public -> mesaclik (para o app também refletir)
CREATE OR REPLACE FUNCTION public.sync_public_reservation_settings_to_mesaclik()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik', 'extensions'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM mesaclik.reservation_settings
    WHERE restaurant_id = OLD.restaurant_id;
    RETURN OLD;
  ELSE
    INSERT INTO mesaclik.reservation_settings (
      restaurant_id,
      max_party_size,
      tolerance_minutes,
      updated_at
    )
    VALUES (
      NEW.restaurant_id,
      COALESCE(NEW.max_party_size, 8),
      COALESCE(NEW.tolerance_minutes, 15),
      now()
    )
    ON CONFLICT (restaurant_id)
    DO UPDATE SET
      max_party_size = EXCLUDED.max_party_size,
      tolerance_minutes = EXCLUDED.tolerance_minutes,
      updated_at = now();

    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_public_reservation_settings_to_mesaclik_ins_upd ON public.reservation_settings;
DROP TRIGGER IF EXISTS trg_public_reservation_settings_to_mesaclik_del ON public.reservation_settings;

CREATE TRIGGER trg_public_reservation_settings_to_mesaclik_ins_upd
AFTER INSERT OR UPDATE ON public.reservation_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_reservation_settings_to_mesaclik();

CREATE TRIGGER trg_public_reservation_settings_to_mesaclik_del
AFTER DELETE ON public.reservation_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_reservation_settings_to_mesaclik();

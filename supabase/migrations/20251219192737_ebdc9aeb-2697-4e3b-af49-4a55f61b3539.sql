-- Prevent infinite recursion between public <-> mesaclik sync triggers

CREATE OR REPLACE FUNCTION public.sync_queue_settings_to_public()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'mesaclik', 'extensions'
AS $function$
BEGIN
  -- If this trigger was fired by a sync coming from the other side, do nothing.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.sync_public_queue_settings_to_mesaclik()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'mesaclik', 'extensions'
AS $function$
BEGIN
  -- If this trigger was fired by a sync coming from the other side, do nothing.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.sync_public_reservation_settings_to_mesaclik()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'mesaclik', 'extensions'
AS $function$
BEGIN
  -- If this trigger was fired by a sync coming from the other side, do nothing.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.sync_reservation_settings_to_public()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'mesaclik', 'extensions'
AS $function$
BEGIN
  -- If this trigger was fired by a sync coming from the other side, do nothing.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

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
$function$;
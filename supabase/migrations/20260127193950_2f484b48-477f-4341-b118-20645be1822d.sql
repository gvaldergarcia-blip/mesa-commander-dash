-- Fix trigger que quebra quando status vira 'cleared'
-- Erro atual: "CASE statement is missing ELSE part" / "case not found"

CREATE OR REPLACE FUNCTION mesaclik.tg_queue_entries_set_ts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'mesaclik', 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      CASE NEW.status
        WHEN 'waiting'  THEN NULL;
        WHEN 'called'   THEN NEW.called_at   := COALESCE(NEW.called_at,   now());
        WHEN 'seated'   THEN NEW.seated_at   := COALESCE(NEW.seated_at,   now());
        WHEN 'canceled' THEN NEW.canceled_at := COALESCE(NEW.canceled_at, now());
        WHEN 'no_show'  THEN NEW.no_show_at  := COALESCE(NEW.no_show_at,  now());
        WHEN 'cleared'  THEN NEW.canceled_at := COALESCE(NEW.canceled_at, now());
        ELSE NULL;
      END CASE;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;
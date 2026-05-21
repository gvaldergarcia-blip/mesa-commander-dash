CREATE OR REPLACE FUNCTION mesaclik.ensure_reservation_status_valid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status::text = 'seated' THEN
        NEW.status := 'pending'::mesaclik.reservation_status;
    END IF;
    IF NEW.status::text NOT IN ('pending', 'confirmed', 'canceled', 'completed', 'no_show') THEN
        RAISE EXCEPTION 'Status inválido: %. Use: pending, confirmed, canceled, completed, no_show', NEW.status;
    END IF;
    IF NEW.status::text = 'no_show' AND NEW.no_show_at IS NULL THEN
        NEW.no_show_at := now();
    END IF;
    RETURN NEW;
END;
$$;
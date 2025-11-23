-- Corrigir o trigger que usa 'attended' para usar apenas valores válidos do enum
DROP TRIGGER IF EXISTS reservation_loyalty_trigger ON mesaclik.reservations;

CREATE OR REPLACE FUNCTION mesaclik.trigger_increment_loyalty_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'mesaclik', 'public'
AS $$
BEGIN
  -- Usar apenas 'completed' que é o valor válido no enum
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM mesaclik.increment_customer_loyalty(
        NEW.restaurant_id,
        NEW.customer_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER reservation_loyalty_trigger
  AFTER UPDATE ON mesaclik.reservations
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.trigger_increment_loyalty_reservation();
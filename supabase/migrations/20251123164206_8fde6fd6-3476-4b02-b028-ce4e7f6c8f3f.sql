-- Corrigir o trigger para verificar se o cliente existe antes de incrementar loyalty
DROP TRIGGER IF EXISTS reservation_loyalty_trigger ON mesaclik.reservations;

CREATE OR REPLACE FUNCTION mesaclik.trigger_increment_loyalty_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'mesaclik', 'public'
AS $$
DECLARE
  v_customer_exists BOOLEAN;
BEGIN
  -- Usar apenas 'completed' que é o valor válido no enum
  IF NEW.status = 'completed' 
     AND (OLD.status IS NULL OR OLD.status != 'completed') 
     AND NEW.user_id IS NOT NULL THEN
    
    -- Verificar se o user_id existe na tabela customers
    SELECT EXISTS (
      SELECT 1 FROM mesaclik.customers 
      WHERE id = NEW.user_id
    ) INTO v_customer_exists;
    
    -- Só incrementar se o cliente existir
    IF v_customer_exists THEN
      PERFORM mesaclik.increment_customer_loyalty(
        NEW.restaurant_id,
        NEW.user_id
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
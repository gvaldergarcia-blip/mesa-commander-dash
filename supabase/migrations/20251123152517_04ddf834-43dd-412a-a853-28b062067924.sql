-- Corrigir trigger para não tentar criar loyalty para clientes manuais (UUID zerado)
CREATE OR REPLACE FUNCTION mesaclik.trigger_increment_loyalty_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'mesaclik', 'public'
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    -- Não processar loyalty para clientes manuais (UUID zerado)
    IF NEW.user_id IS NOT NULL AND NEW.user_id != '00000000-0000-0000-0000-000000000000' THEN
      SELECT q.restaurant_id INTO v_restaurant_id
      FROM mesaclik.queues q
      WHERE q.id = NEW.queue_id;
      
      IF v_restaurant_id IS NOT NULL THEN
        PERFORM mesaclik.increment_customer_loyalty(v_restaurant_id, NEW.user_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
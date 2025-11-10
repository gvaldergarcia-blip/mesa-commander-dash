-- Funções e Triggers para Sistema 10 Cliks (SEM VIEW)
-- ============================================================================

-- Função para incrementar pontos e visitas
CREATE OR REPLACE FUNCTION mesaclik.increment_customer_loyalty(
  p_restaurant_id uuid,
  p_customer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  -- Criar/incrementar registro de visitas
  INSERT INTO mesaclik.restaurant_customers (
    restaurant_id,
    customer_id,
    visits_count,
    last_visit_at,
    updated_at
  )
  VALUES (
    p_restaurant_id,
    p_customer_id,
    1,
    now(),
    now()
  )
  ON CONFLICT (restaurant_id, customer_id)
  DO UPDATE SET
    visits_count = mesaclik.restaurant_customers.visits_count + 1,
    last_visit_at = now(),
    updated_at = now();

  -- Incrementar pontos de fidelidade (se programa ativo)
  IF EXISTS (
    SELECT 1 FROM mesaclik.loyalty_programs lp
    WHERE lp.restaurant_id = p_restaurant_id
    AND lp.enabled = true
  ) THEN
    INSERT INTO mesaclik.loyalty_points (
      restaurant_id,
      customer_id,
      points,
      last_earned_at,
      updated_at
    )
    VALUES (
      p_restaurant_id,
      p_customer_id,
      1,
      now(),
      now()
    )
    ON CONFLICT (restaurant_id, customer_id)
    DO UPDATE SET
      points = mesaclik.loyalty_points.points + 1,
      last_earned_at = now(),
      updated_at = now();
  END IF;
END;
$$;

-- Trigger para incrementar pontos quando fila é sentada
CREATE OR REPLACE FUNCTION mesaclik.trigger_increment_loyalty_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    IF NEW.customer_id IS NOT NULL THEN
      SELECT q.restaurant_id INTO v_restaurant_id
      FROM mesaclik.queues q
      WHERE q.id = NEW.queue_id;
      
      IF v_restaurant_id IS NOT NULL THEN
        PERFORM mesaclik.increment_customer_loyalty(v_restaurant_id, NEW.customer_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_entry_loyalty_trigger ON mesaclik.queue_entries;
CREATE TRIGGER queue_entry_loyalty_trigger
  AFTER UPDATE ON mesaclik.queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.trigger_increment_loyalty_queue();

-- Trigger para incrementar pontos quando reserva é completada
CREATE OR REPLACE FUNCTION mesaclik.trigger_increment_loyalty_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  IF NEW.status IN ('attended', 'completed') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('attended', 'completed')) THEN
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

DROP TRIGGER IF EXISTS reservation_loyalty_trigger ON mesaclik.reservations;
CREATE TRIGGER reservation_loyalty_trigger
  AFTER UPDATE ON mesaclik.reservations
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.trigger_increment_loyalty_reservation();

-- Função para resetar pontos do cliente
CREATE OR REPLACE FUNCTION mesaclik.reset_customer_loyalty_points(
  p_restaurant_id uuid,
  p_customer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.loyalty_points
  SET points = 0,
      updated_at = now()
  WHERE restaurant_id = p_restaurant_id
    AND customer_id = p_customer_id;
END;
$$;
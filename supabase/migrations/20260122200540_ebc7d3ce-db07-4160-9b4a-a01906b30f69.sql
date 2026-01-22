-- =====================================================
-- TRIGGER: Alimentar customer_metrics automaticamente
-- Dispara quando queue_entries ou reservations são atualizadas
-- =====================================================

-- 1) Função para atualizar métricas quando cliente é sentado na fila
CREATE OR REPLACE FUNCTION public.update_customer_metrics_on_queue_seated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_restaurant_id UUID;
  v_customer_id UUID;
  v_wait_minutes INTEGER;
  v_customer_record RECORD;
BEGIN
  -- Só processa se status mudou para 'seated'
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    
    -- Buscar restaurant_id através da queue
    SELECT q.restaurant_id INTO v_restaurant_id
    FROM queues q
    WHERE q.id = NEW.queue_id;
    
    -- Calcular tempo de espera em minutos
    v_wait_minutes := EXTRACT(EPOCH FROM (COALESCE(NEW.seated_at, NOW()) - NEW.created_at)) / 60;
    
    -- Buscar customer_id do restaurant_customers pelo telefone
    SELECT id INTO v_customer_id
    FROM restaurant_customers
    WHERE restaurant_id = v_restaurant_id
      AND customer_phone = NEW.phone
    LIMIT 1;
    
    -- Se encontrou o cliente, atualizar/inserir métricas
    IF v_customer_id IS NOT NULL THEN
      INSERT INTO customer_metrics (
        restaurant_id,
        customer_id,
        total_visits,
        visits_last_30d,
        last_visit_at,
        last_queue_wait_minutes,
        avg_wait_minutes
      )
      VALUES (
        v_restaurant_id,
        v_customer_id,
        1,
        1,
        NOW(),
        v_wait_minutes,
        v_wait_minutes
      )
      ON CONFLICT (restaurant_id, customer_id) DO UPDATE SET
        total_visits = customer_metrics.total_visits + 1,
        visits_last_30d = customer_metrics.visits_last_30d + 1,
        last_visit_at = NOW(),
        last_queue_wait_minutes = v_wait_minutes,
        avg_wait_minutes = (COALESCE(customer_metrics.avg_wait_minutes, 0) * customer_metrics.total_visits + v_wait_minutes) / (customer_metrics.total_visits + 1),
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2) Função para atualizar métricas em no-show/cancelamento
CREATE OR REPLACE FUNCTION public.update_customer_metrics_on_queue_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_restaurant_id UUID;
  v_customer_id UUID;
BEGIN
  -- Buscar restaurant_id através da queue
  SELECT q.restaurant_id INTO v_restaurant_id
  FROM queues q
  WHERE q.id = NEW.queue_id;
  
  -- Buscar customer_id pelo telefone
  SELECT id INTO v_customer_id
  FROM restaurant_customers
  WHERE restaurant_id = v_restaurant_id
    AND customer_phone = NEW.phone
  LIMIT 1;
  
  IF v_customer_id IS NOT NULL THEN
    -- No-show
    IF NEW.status = 'no_show' AND (OLD.status IS NULL OR OLD.status != 'no_show') THEN
      INSERT INTO customer_metrics (restaurant_id, customer_id, no_show_count)
      VALUES (v_restaurant_id, v_customer_id, 1)
      ON CONFLICT (restaurant_id, customer_id) DO UPDATE SET
        no_show_count = customer_metrics.no_show_count + 1,
        updated_at = NOW();
    END IF;
    
    -- Cancelamento
    IF NEW.status = 'canceled' AND (OLD.status IS NULL OR OLD.status != 'canceled') THEN
      INSERT INTO customer_metrics (restaurant_id, customer_id, cancel_count)
      VALUES (v_restaurant_id, v_customer_id, 1)
      ON CONFLICT (restaurant_id, customer_id) DO UPDATE SET
        cancel_count = customer_metrics.cancel_count + 1,
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3) Função para reservas completadas
CREATE OR REPLACE FUNCTION public.update_customer_metrics_on_reservation_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Só processa se status mudou para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Buscar customer_id pelo telefone
    SELECT id INTO v_customer_id
    FROM restaurant_customers
    WHERE restaurant_id = NEW.restaurant_id
      AND customer_phone = NEW.phone
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      INSERT INTO customer_metrics (
        restaurant_id,
        customer_id,
        total_visits,
        visits_last_30d,
        last_visit_at
      )
      VALUES (
        NEW.restaurant_id,
        v_customer_id,
        1,
        1,
        NOW()
      )
      ON CONFLICT (restaurant_id, customer_id) DO UPDATE SET
        total_visits = customer_metrics.total_visits + 1,
        visits_last_30d = customer_metrics.visits_last_30d + 1,
        last_visit_at = NOW(),
        updated_at = NOW();
    END IF;
  END IF;
  
  -- No-show em reserva
  IF NEW.status = 'canceled' AND NEW.cancel_reason ILIKE '%no_show%' THEN
    SELECT id INTO v_customer_id
    FROM restaurant_customers
    WHERE restaurant_id = NEW.restaurant_id
      AND customer_phone = NEW.phone
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      INSERT INTO customer_metrics (restaurant_id, customer_id, no_show_count)
      VALUES (NEW.restaurant_id, v_customer_id, 1)
      ON CONFLICT (restaurant_id, customer_id) DO UPDATE SET
        no_show_count = customer_metrics.no_show_count + 1,
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4) Criar os triggers nas tabelas
DROP TRIGGER IF EXISTS trg_queue_entries_metrics_seated ON queue_entries;
CREATE TRIGGER trg_queue_entries_metrics_seated
  AFTER UPDATE ON queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_metrics_on_queue_seated();

DROP TRIGGER IF EXISTS trg_queue_entries_metrics_status ON queue_entries;
CREATE TRIGGER trg_queue_entries_metrics_status
  AFTER UPDATE ON queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_metrics_on_queue_status();

DROP TRIGGER IF EXISTS trg_reservations_metrics ON reservations;
CREATE TRIGGER trg_reservations_metrics
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_metrics_on_reservation_completed();

-- 5) Função para resetar visits_last_30d mensalmente (pode ser chamada via CRON)
CREATE OR REPLACE FUNCTION public.rotate_customer_visits_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE customer_metrics
  SET 
    visits_prev_30d = visits_last_30d,
    visits_last_30d = 0,
    updated_at = NOW();
END;
$$;

-- 6) Adicionar comentários
COMMENT ON FUNCTION public.update_customer_metrics_on_queue_seated IS 'Atualiza customer_metrics quando cliente é sentado na fila (tempo de espera)';
COMMENT ON FUNCTION public.update_customer_metrics_on_queue_status IS 'Atualiza customer_metrics para no-shows e cancelamentos';
COMMENT ON FUNCTION public.update_customer_metrics_on_reservation_completed IS 'Atualiza customer_metrics quando reserva é completada';
COMMENT ON FUNCTION public.rotate_customer_visits_monthly IS 'Rotaciona contadores mensais de visitas (chamar via CRON no dia 1)';
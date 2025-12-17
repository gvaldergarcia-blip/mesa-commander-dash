-- Função para criar/atualizar cliente quando entrada na fila é sentada
CREATE OR REPLACE FUNCTION mesaclik.upsert_customer_on_queue_seated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, mesaclik
AS $$
DECLARE
  v_existing_customer_id uuid;
  v_now timestamptz := now();
  v_name text;
BEGIN
  -- Só executa se status mudou para 'seated'
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    
    -- Pegar nome do cliente (pode estar em 'name' ou 'customer_name')
    v_name := COALESCE(NEW.name, NEW.customer_name);
    
    -- Buscar cliente existente por phone (se tiver) ou por nome
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
      SELECT id INTO v_existing_customer_id
      FROM public.customers
      WHERE phone = NEW.phone
      LIMIT 1;
    END IF;
    
    -- Se não encontrou por phone, busca por nome
    IF v_existing_customer_id IS NULL AND v_name IS NOT NULL THEN
      SELECT id INTO v_existing_customer_id
      FROM public.customers
      WHERE name = v_name
      LIMIT 1;
    END IF;
    
    IF v_existing_customer_id IS NOT NULL THEN
      -- Atualizar cliente existente
      UPDATE public.customers
      SET 
        queue_completed = queue_completed + 1,
        total_visits = total_visits + 1,
        vip_status = CASE WHEN (total_visits + 1) >= 10 THEN true ELSE vip_status END,
        last_visit_date = v_now,
        updated_at = v_now,
        phone = COALESCE(phone, NEW.phone)
      WHERE id = v_existing_customer_id;
    ELSE
      -- Criar novo cliente
      INSERT INTO public.customers (
        name,
        phone,
        reservations_completed,
        queue_completed,
        total_visits,
        vip_status,
        first_visit_at,
        last_visit_date,
        created_at,
        updated_at
      ) VALUES (
        v_name,
        NEW.phone,
        0,
        1,
        1,
        false,
        v_now,
        v_now,
        v_now,
        v_now
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela mesaclik.queue_entries
DROP TRIGGER IF EXISTS trigger_upsert_customer_on_queue_seated ON mesaclik.queue_entries;

CREATE TRIGGER trigger_upsert_customer_on_queue_seated
  AFTER UPDATE ON mesaclik.queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.upsert_customer_on_queue_seated();
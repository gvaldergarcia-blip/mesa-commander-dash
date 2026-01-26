-- Criar função RPC para upsert de clientes (SECURITY DEFINER para bypassar RLS)
-- Usada quando um cliente é atendido (seated) na fila ou reserva
CREATE OR REPLACE FUNCTION public.upsert_customer_from_queue(
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Se não tem phone, não pode criar/atualizar
  IF p_phone IS NULL OR p_phone = '' OR p_phone = '—' THEN
    RETURN NULL;
  END IF;

  -- Tentar encontrar cliente existente pelo phone
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE phone = p_phone
  LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    -- Atualizar cliente existente
    UPDATE public.customers
    SET
      queue_completed = queue_completed + 1,
      total_visits = total_visits + 1,
      last_visit_date = CURRENT_DATE,
      updated_at = NOW(),
      name = COALESCE(NULLIF(p_name, ''), name),
      email = COALESCE(NULLIF(p_email, ''), email)
    WHERE id = v_customer_id;
  ELSE
    -- Criar novo cliente
    INSERT INTO public.customers (
      name,
      phone,
      email,
      queue_completed,
      total_visits,
      first_visit_at,
      last_visit_date
    )
    VALUES (
      COALESCE(NULLIF(p_name, ''), 'Cliente'),
      p_phone,
      NULLIF(p_email, ''),
      1,
      1,
      NOW(),
      CURRENT_DATE
    )
    RETURNING id INTO v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$;

-- Atualizar trigger para usar a nova função RPC
CREATE OR REPLACE FUNCTION public.upsert_customer_on_queue_seated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik', 'extensions'
AS $$
DECLARE
  v_customer_name text;
  v_phone text;
  v_email text;
  v_customer_id uuid;
BEGIN
  -- Only process when status changes to 'seated'
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    -- Get customer data from the queue entry in mesaclik schema
    SELECT qe.name, qe.phone, qe.email
      INTO v_customer_name, v_phone, v_email
    FROM mesaclik.queue_entries qe
    WHERE qe.id = NEW.id;

    -- Skip if no phone number or it's a placeholder
    IF v_phone IS NULL OR v_phone = '' OR v_phone = '—' THEN
      -- Tentar usar email como identificador alternativo se disponível
      IF v_email IS NOT NULL AND v_email != '' THEN
        -- Buscar por email
        SELECT id INTO v_customer_id
        FROM public.customers
        WHERE email = v_email
        LIMIT 1;
        
        IF v_customer_id IS NOT NULL THEN
          UPDATE public.customers
          SET
            queue_completed = queue_completed + 1,
            total_visits = total_visits + 1,
            last_visit_date = CURRENT_DATE,
            updated_at = NOW(),
            name = COALESCE(NULLIF(v_customer_name, ''), name)
          WHERE id = v_customer_id;
        ELSE
          -- Criar com email como identificador
          INSERT INTO public.customers (
            name,
            email,
            queue_completed,
            total_visits,
            first_visit_at,
            last_visit_date
          )
          VALUES (
            COALESCE(NULLIF(v_customer_name, ''), 'Cliente'),
            v_email,
            1,
            1,
            NOW(),
            CURRENT_DATE
          );
        END IF;
      END IF;
      
      RETURN NEW;
    END IF;

    -- Usar a função RPC que tem permissões adequadas
    PERFORM public.upsert_customer_from_queue(v_customer_name, v_phone, v_email);
  END IF;

  RETURN NEW;
END;
$$;
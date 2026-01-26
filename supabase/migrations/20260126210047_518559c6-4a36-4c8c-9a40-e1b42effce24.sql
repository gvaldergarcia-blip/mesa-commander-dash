-- Fix: public.restaurant_customers.total_visits is a GENERATED column
-- The trigger must not attempt to INSERT/UPDATE it.

CREATE OR REPLACE FUNCTION public.upsert_customer_on_queue_seated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik', 'extensions'
AS $function$
DECLARE
  v_customer_name text;
  v_phone text;
  v_email text;
  v_customer_id uuid;
  v_restaurant_id uuid;
BEGIN
  -- Only process when status changes to 'seated'
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    -- Get customer data and restaurant_id from the queue entry
    SELECT qe.name, qe.phone, qe.email, q.restaurant_id
      INTO v_customer_name, v_phone, v_email, v_restaurant_id
    FROM mesaclik.queue_entries qe
    JOIN mesaclik.queues q ON q.id = qe.queue_id
    WHERE qe.id = NEW.id;

    -- ===========================================
    -- PARTE 1: Upsert em public.customers (global)
    -- ===========================================
    IF v_phone IS NOT NULL AND v_phone != '' AND v_phone != '—' THEN
      -- Usar a função RPC que tem permissões adequadas
      PERFORM public.upsert_customer_from_queue(v_customer_name, v_phone, v_email);
    ELSIF v_email IS NOT NULL AND v_email != '' THEN
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

    -- ===========================================
    -- PARTE 2: Upsert em public.restaurant_customers (CRM por restaurante)
    -- Só se tivermos email (identificador principal do CRM)
    -- ===========================================
    IF v_email IS NOT NULL AND v_email != '' AND v_restaurant_id IS NOT NULL THEN
      INSERT INTO public.restaurant_customers (
        restaurant_id,
        customer_email,
        customer_name,
        customer_phone,
        last_seen_at,
        total_queue_visits,
        total_reservation_visits,
        status,
        vip
      )
      VALUES (
        v_restaurant_id,
        lower(trim(v_email)),
        NULLIF(trim(v_customer_name), ''),
        NULLIF(trim(v_phone), ''),
        NOW(),
        1,
        0,
        'active',
        false
      )
      ON CONFLICT (restaurant_id, customer_email) DO UPDATE SET
        customer_name = COALESCE(NULLIF(trim(EXCLUDED.customer_name), ''), restaurant_customers.customer_name),
        customer_phone = COALESCE(NULLIF(trim(EXCLUDED.customer_phone), ''), restaurant_customers.customer_phone),
        last_seen_at = NOW(),
        total_queue_visits = restaurant_customers.total_queue_visits + 1,
        total_reservation_visits = restaurant_customers.total_reservation_visits,
        status = 'active',
        -- Atualizar VIP se atingiu 10 visitas (total_visits é gerado = queue + reservation)
        vip = CASE
          WHEN (restaurant_customers.total_queue_visits + restaurant_customers.total_reservation_visits + 1) >= 10 THEN true
          ELSE restaurant_customers.vip
        END,
        updated_at = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
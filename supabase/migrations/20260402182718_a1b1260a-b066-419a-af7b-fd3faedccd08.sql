DROP FUNCTION IF EXISTS public.register_customer_visit(uuid, text, text, text, text, text, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.register_customer_visit(
  p_restaurant_id uuid,
  p_email text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_visit_date timestamptz DEFAULT NULL,
  p_source text DEFAULT 'registro_manual',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_visit_id uuid;
  v_sanitized_email text;
  v_sanitized_phone text;
  v_is_new boolean := false;
BEGIN
  v_sanitized_phone := regexp_replace(COALESCE(TRIM(p_phone), ''), '\D', '', 'g');
  v_sanitized_email := LOWER(TRIM(COALESCE(p_email, '')));

  IF v_sanitized_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone é obrigatório');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.restaurants
    WHERE id = p_restaurant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  SELECT id INTO v_customer_id
  FROM public.restaurant_customers
  WHERE restaurant_id = p_restaurant_id
    AND regexp_replace(COALESCE(customer_phone, ''), '\D', '', 'g') = v_sanitized_phone
  LIMIT 1;

  IF v_customer_id IS NULL AND v_sanitized_email <> '' THEN
    SELECT id INTO v_customer_id
    FROM public.restaurant_customers
    WHERE restaurant_id = p_restaurant_id
      AND customer_email = v_sanitized_email
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    v_is_new := true;
    v_customer_id := public.upsert_restaurant_customer(
      p_restaurant_id,
      CASE
        WHEN v_sanitized_email <> '' THEN v_sanitized_email
        ELSE v_sanitized_phone || '@phone.local'
      END,
      p_name,
      p_phone,
      'manual'::text,
      NULL::boolean,
      NULL::boolean,
      'v1'::text,
      'v1'::text
    );
  END IF;

  INSERT INTO public.customer_visits (
    restaurant_id,
    customer_id,
    visit_date,
    source,
    notes,
    registered_by
  )
  VALUES (
    p_restaurant_id,
    v_customer_id,
    COALESCE(p_visit_date, now()),
    p_source,
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_visit_id;

  UPDATE public.restaurant_customers
  SET
    total_manual_visits = COALESCE(total_manual_visits, 0) + 1,
    last_seen_at = GREATEST(
      COALESCE(last_seen_at, COALESCE(p_visit_date, now())),
      COALESCE(p_visit_date, now())
    ),
    customer_email = CASE
      WHEN v_sanitized_email <> '' AND customer_email LIKE '%@phone.local' THEN v_sanitized_email
      ELSE customer_email
    END,
    vip = CASE
      WHEN (
        COALESCE(total_queue_visits, 0)
        + COALESCE(total_reservation_visits, 0)
        + COALESCE(total_manual_visits, 0)
        + 1
      ) >= 10 THEN true
      ELSE vip
    END
  WHERE id = v_customer_id;

  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id,
    'visit_id', v_visit_id,
    'is_new_customer', v_is_new,
    'message', CASE
      WHEN v_is_new THEN 'Cliente cadastrado e visita registrada'
      ELSE 'Visita registrada com sucesso'
    END
  );
END;
$$;
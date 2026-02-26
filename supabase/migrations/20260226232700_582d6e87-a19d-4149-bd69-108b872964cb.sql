CREATE OR REPLACE FUNCTION public.register_customer_visit(
  p_restaurant_id uuid,
  p_email text,
  p_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_visit_date timestamp with time zone DEFAULT now(),
  p_source text DEFAULT 'registro_manual'::text,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_visit_id uuid;
  v_sanitized_email text;
  v_is_new boolean := false;
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email é obrigatório');
  END IF;

  v_sanitized_email := LOWER(TRIM(p_email));

  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  SELECT id INTO v_customer_id
  FROM public.restaurant_customers
  WHERE restaurant_id = p_restaurant_id
    AND customer_email = v_sanitized_email;

  IF v_customer_id IS NULL THEN
    v_is_new := true;
    v_customer_id := public.upsert_restaurant_customer(
      p_restaurant_id,
      v_sanitized_email,
      p_name,
      p_phone,
      'manual'::text,
      NULL::boolean,
      NULL::boolean,
      'v1'::text,
      'v1'::text
    );
  END IF;

  INSERT INTO public.customer_visits (restaurant_id, customer_id, visit_date, source, notes, registered_by)
  VALUES (
    p_restaurant_id,
    v_customer_id,
    COALESCE(p_visit_date, now()),
    p_source,
    NULLIF(TRIM(p_notes), ''),
    auth.uid()
  )
  RETURNING id INTO v_visit_id;

  UPDATE public.restaurant_customers
  SET
    total_manual_visits = COALESCE(total_manual_visits, 0) + 1,
    last_seen_at = GREATEST(COALESCE(last_seen_at, COALESCE(p_visit_date, now())), COALESCE(p_visit_date, now())),
    vip = CASE
      WHEN (COALESCE(total_queue_visits, 0) + COALESCE(total_reservation_visits, 0) + COALESCE(total_manual_visits, 0) + 1) >= 10 THEN true
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
$function$;
CREATE OR REPLACE FUNCTION public.register_customer_visit(
  p_restaurant_id uuid, 
  p_email text, 
  p_name text DEFAULT NULL, 
  p_phone text DEFAULT NULL, 
  p_visit_date timestamptz DEFAULT now(), 
  p_source text DEFAULT 'registro_manual', 
  p_notes text DEFAULT NULL
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
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email é obrigatório');
  END IF;
  v_sanitized_email := LOWER(TRIM(p_email));

  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- Upsert customer using explicit cast to avoid ambiguity with overloaded functions
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

  -- Insert visit
  INSERT INTO public.customer_visits (restaurant_id, customer_id, visit_date, source, notes, registered_by)
  VALUES (p_restaurant_id, v_customer_id, COALESCE(p_visit_date, now()), p_source, NULLIF(TRIM(p_notes), ''), auth.uid())
  RETURNING id INTO v_visit_id;

  -- Update counters
  UPDATE public.restaurant_customers
  SET 
    total_manual_visits = total_manual_visits + 1,
    total_visits = total_queue_visits + total_reservation_visits + total_manual_visits + 1,
    last_seen_at = GREATEST(last_seen_at, COALESCE(p_visit_date, now())),
    vip = CASE WHEN (total_queue_visits + total_reservation_visits + total_manual_visits + 1) >= 10 THEN true ELSE vip END
  WHERE id = v_customer_id;

  RETURN jsonb_build_object('success', true, 'customer_id', v_customer_id, 'visit_id', v_visit_id, 'message', 'Visita registrada com sucesso');
END;
$function$;
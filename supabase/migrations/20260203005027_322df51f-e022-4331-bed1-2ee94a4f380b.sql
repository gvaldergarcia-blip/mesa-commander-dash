-- Fix: Prevent CRM upsert (public.upsert_restaurant_customer) from blocking queue entry creation.
-- Reason: upsert_restaurant_customer validates restaurant exists in public.restaurants, but our canonical restaurants live in mesaclik.restaurants.
-- In this flow, CRM upsert is non-critical; queue entry creation must succeed regardless.

CREATE OR REPLACE FUNCTION mesaclik.add_customer_to_queue(
  p_restaurant_id uuid,
  p_queue_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_party_size integer,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'mesaclik', 'public'
AS $function$
DECLARE
  v_entry_id uuid;
  v_phone text;
  v_user_id uuid;
  v_crm_warning text;
BEGIN
  -- Validate inputs
  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome do cliente é obrigatório');
  END IF;

  IF p_party_size IS NULL OR p_party_size < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tamanho do grupo inválido');
  END IF;

  IF p_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurant ID é obrigatório');
  END IF;

  IF p_queue_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue ID é obrigatório');
  END IF;

  -- Authorization: Allow if user is authorized, or dev-mode access (no auth)
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_restaurant_authorized(p_restaurant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not own this restaurant');
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM mesaclik.restaurants r
      JOIN public.user_roles ur ON ur.user_id = r.owner_id
      WHERE r.id = p_restaurant_id
        AND ur.role = 'admin'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Restaurant access denied');
    END IF;
  END IF;

  -- Validate queue belongs to restaurant
  IF NOT EXISTS (
    SELECT 1
    FROM mesaclik.queues q
    WHERE q.id = p_queue_id
      AND q.restaurant_id = p_restaurant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fila inválida para este restaurante');
  END IF;

  -- Determine user_id (required by mesaclik.queue_entries)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    SELECT r.owner_id INTO v_user_id
    FROM mesaclik.restaurants r
    WHERE r.id = p_restaurant_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não foi possível determinar o usuário responsável (user_id)');
  END IF;

  -- Use email as placeholder phone if needed
  v_phone := COALESCE(NULLIF(trim(p_customer_email), ''), 'no-phone');

  -- Insert queue entry (includes user_id)
  INSERT INTO mesaclik.queue_entries (
    restaurant_id,
    queue_id,
    user_id,
    name,
    email,
    phone,
    party_size,
    notes,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_restaurant_id,
    p_queue_id,
    v_user_id,
    trim(p_customer_name),
    NULLIF(trim(p_customer_email), ''),
    v_phone,
    p_party_size,
    NULLIF(trim(p_notes), ''),
    'waiting',
    now(),
    now()
  )
  RETURNING id INTO v_entry_id;

  -- Best-effort CRM upsert (must not block queue flow)
  IF p_customer_email IS NOT NULL AND trim(p_customer_email) != '' THEN
    BEGIN
      -- Only attempt if public.restaurants has the row (some projects use mesaclik as canonical schema)
      IF EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
        PERFORM public.upsert_restaurant_customer(
          p_restaurant_id,
          trim(p_customer_email),
          trim(p_customer_name),
          NULL,
          'queue',
          NULL,
          NULL
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_crm_warning := 'crm_upsert_failed';
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'entry_id', v_entry_id, 'warning', v_crm_warning);
END;
$function$;

GRANT EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text) TO anon, authenticated;
-- Drop the old overload without p_customer_phone to avoid ambiguity
DROP FUNCTION IF EXISTS mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text);

-- Recreate the single correct version with phone sanitization and auto-create exclusive queue
CREATE OR REPLACE FUNCTION mesaclik.add_customer_to_queue(
  p_restaurant_id uuid,
  p_queue_id uuid,
  p_customer_name text,
  p_customer_phone text DEFAULT NULL::text,
  p_customer_email text DEFAULT NULL::text,
  p_party_size integer DEFAULT 1,
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
  v_email text;
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

  -- Phone is required
  IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone do cliente é obrigatório');
  END IF;

  -- Authorization
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

  -- Determine user_id
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    SELECT r.owner_id INTO v_user_id
    FROM mesaclik.restaurants r
    WHERE r.id = p_restaurant_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não foi possível determinar o usuário responsável (user_id)');
  END IF;

  -- Sanitize phone (strip formatting, keep digits only)
  v_phone := regexp_replace(trim(p_customer_phone), '\D', '', 'g');
  v_email := NULLIF(trim(COALESCE(p_customer_email, '')), '');

  -- Insert queue entry
  INSERT INTO mesaclik.queue_entries (
    restaurant_id, queue_id, user_id, name, email, phone,
    party_size, notes, status, created_at, updated_at
  )
  VALUES (
    p_restaurant_id, p_queue_id, v_user_id,
    trim(p_customer_name), v_email, v_phone,
    p_party_size, NULLIF(trim(COALESCE(p_notes, '')), ''),
    'waiting', now(), now()
  )
  RETURNING id INTO v_entry_id;

  -- Best-effort CRM upsert
  BEGIN
    IF EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
      PERFORM public.upsert_restaurant_customer(
        p_restaurant_id,
        COALESCE(v_email, v_phone || '@phone.local'),
        trim(p_customer_name),
        v_phone,
        'queue',
        NULL,
        NULL
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_crm_warning := 'crm_upsert_failed';
  END;

  RETURN jsonb_build_object('success', true, 'entry_id', v_entry_id, 'warning', v_crm_warning);
END;
$function$;
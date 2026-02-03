-- Fix add_customer_to_queue to include restaurant_id in the INSERT
DROP FUNCTION IF EXISTS mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text);

CREATE OR REPLACE FUNCTION mesaclik.add_customer_to_queue(
  p_restaurant_id uuid,
  p_queue_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_party_size integer,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
DECLARE
  v_entry_id uuid;
  v_phone text;
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
  
  -- Authorization: Allow if user is admin, restaurant owner, or in dev mode (no auth)
  IF auth.uid() IS NOT NULL THEN
    -- User is authenticated - check if authorized
    IF NOT public.is_restaurant_authorized(p_restaurant_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not own this restaurant');
    END IF;
  ELSE
    -- No auth (dev mode) - check if restaurant owner is admin (development access)
    IF NOT EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      JOIN public.user_roles ur ON ur.user_id = r.owner_id
      WHERE r.id = p_restaurant_id AND ur.role = 'admin'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Restaurant access denied');
    END IF;
  END IF;
  
  -- Use email as placeholder phone if needed
  v_phone := COALESCE(p_customer_email, 'no-phone');
  
  -- Insert queue entry WITH restaurant_id
  INSERT INTO mesaclik.queue_entries (
    restaurant_id,
    queue_id,
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
  
  -- Upsert restaurant_customer if email provided
  IF p_customer_email IS NOT NULL AND trim(p_customer_email) != '' THEN
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
  
  RETURN jsonb_build_object('success', true, 'entry_id', v_entry_id);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text) TO anon, authenticated;
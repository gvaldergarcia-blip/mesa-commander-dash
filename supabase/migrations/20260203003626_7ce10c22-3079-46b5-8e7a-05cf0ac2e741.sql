-- Drop existing function to change return type
DROP FUNCTION IF EXISTS mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text);

-- Recreate add_customer_to_queue with jsonb return and dev mode support
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
  
  -- Insert queue entry
  INSERT INTO mesaclik.queue_entries (
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

-- Also fix get_queue_entries to use correct column name (name instead of customer_name)
CREATE OR REPLACE FUNCTION mesaclik.get_queue_entries(
  p_restaurant_id uuid,
  p_hours_back integer DEFAULT 24
)
RETURNS TABLE (
  entry_id uuid,
  queue_id uuid,
  customer_name text,
  phone text,
  email text,
  people integer,
  status text,
  notes text,
  "position" integer,
  called_at timestamptz,
  seated_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qe.id as entry_id,
    qe.queue_id,
    qe.name as customer_name,
    qe.phone,
    COALESCE(qe.email, '') as email,
    qe.party_size as people,
    qe.status::text,
    qe.notes,
    qe.position_number as "position",
    qe.called_at,
    qe.seated_at,
    qe.canceled_at,
    qe.created_at,
    qe.updated_at
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON qe.queue_id = q.id
  WHERE q.restaurant_id = p_restaurant_id
    AND qe.created_at >= (now() - (p_hours_back || ' hours')::interval)
  ORDER BY qe.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION mesaclik.get_queue_entries(uuid, integer) TO anon, authenticated;
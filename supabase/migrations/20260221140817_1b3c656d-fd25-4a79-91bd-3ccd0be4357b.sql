
-- Fix enter_queue: mesaclik.queues does not have created_at, use q.id instead
CREATE OR REPLACE FUNCTION mesaclik.enter_queue(
  p_restaurant_id uuid,
  p_user_id uuid,
  p_party_size int DEFAULT 2,
  p_name text DEFAULT '',
  p_phone text DEFAULT ''
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = mesaclik, public
AS $$
DECLARE
  v_queue_id uuid;
  v_id uuid;
  v_created timestamptz;
  v_updated timestamptz;
BEGIN
  IF EXISTS (
    SELECT 1 FROM mesaclik.queue_entries qe
    WHERE qe.restaurant_id = p_restaurant_id AND qe.user_id = p_user_id AND qe.status = 'waiting'
  ) THEN
    RAISE EXCEPTION 'User already in queue for this restaurant';
  END IF;

  SELECT q.id INTO v_queue_id
  FROM mesaclik.queues q
  WHERE q.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF v_queue_id IS NULL THEN
    INSERT INTO mesaclik.queues (restaurant_id)
    VALUES (p_restaurant_id)
    RETURNING id INTO v_queue_id;
  END IF;

  INSERT INTO mesaclik.queue_entries(
    queue_id, restaurant_id, user_id, party_size, name, phone, status, created_at, updated_at
  ) VALUES (
    v_queue_id,
    p_restaurant_id,
    p_user_id,
    GREATEST(1, COALESCE(p_party_size, 2)),
    COALESCE(NULLIF(TRIM(p_name), ''), 'Visitante'),
    NULLIF(TRIM(p_phone), ''),
    'waiting',
    NOW(),
    NOW()
  ) RETURNING id, created_at, updated_at INTO v_id, v_created, v_updated;

  RETURN json_build_object(
    'id', v_id,
    'restaurant_id', p_restaurant_id,
    'queue_id', v_queue_id,
    'user_id', p_user_id,
    'party_size', GREATEST(1, COALESCE(p_party_size, 2)),
    'name', COALESCE(NULLIF(TRIM(p_name), ''), 'Visitante'),
    'phone', NULLIF(TRIM(p_phone), ''),
    'status', 'waiting',
    'created_at', v_created,
    'updated_at', v_updated
  );
END;
$$;

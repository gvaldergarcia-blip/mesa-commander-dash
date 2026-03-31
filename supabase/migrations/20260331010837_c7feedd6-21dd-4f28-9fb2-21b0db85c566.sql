-- RPC to ensure a queue of a given type exists for a restaurant
CREATE OR REPLACE FUNCTION mesaclik.ensure_queue_exists(
  p_restaurant_id uuid,
  p_queue_type text DEFAULT 'normal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'mesaclik', 'public'
AS $$
DECLARE
  v_queue_id uuid;
BEGIN
  -- Try to find existing
  SELECT id INTO v_queue_id
  FROM mesaclik.queues
  WHERE restaurant_id = p_restaurant_id
    AND queue_type = p_queue_type
  LIMIT 1;

  IF v_queue_id IS NOT NULL THEN
    RETURN v_queue_id;
  END IF;

  -- Create new queue
  INSERT INTO mesaclik.queues (restaurant_id, queue_type)
  VALUES (p_restaurant_id, p_queue_type)
  RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;
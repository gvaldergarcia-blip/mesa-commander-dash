-- Drop existing function first, then recreate with correct return type
DROP FUNCTION IF EXISTS mesaclik.get_queue_entries(UUID, INTEGER);

-- Recreate with fixed column names (avoiding reserved words)
CREATE OR REPLACE FUNCTION mesaclik.get_queue_entries(
  p_restaurant_id UUID,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  entry_id UUID,
  queue_id UUID,
  customer_name TEXT,
  phone TEXT,
  email TEXT,
  people INTEGER,
  status TEXT,
  notes TEXT,
  queue_position INTEGER,
  called_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  -- Get queue_id for restaurant
  SELECT q.id INTO v_queue_id
  FROM mesaclik.queues q
  WHERE q.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF v_queue_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    qe.id AS entry_id,
    qe.queue_id,
    qe.customer_name,
    qe.phone,
    COALESCE(qe.customer_email, '') AS email,
    qe.party_size AS people,
    qe.status::TEXT,
    qe.notes,
    ROW_NUMBER() OVER (
      PARTITION BY 
        CASE 
          WHEN qe.party_size <= 2 THEN '1-2'
          WHEN qe.party_size <= 4 THEN '3-4'
          WHEN qe.party_size <= 6 THEN '5-6'
          WHEN qe.party_size <= 8 THEN '7-8'
          ELSE '9+'
        END
      ORDER BY qe.created_at ASC
    )::INTEGER AS queue_position,
    qe.called_at,
    qe.seated_at,
    qe.canceled_at,
    qe.created_at,
    qe.updated_at
  FROM mesaclik.queue_entries qe
  WHERE qe.queue_id = v_queue_id
    AND qe.created_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  ORDER BY qe.created_at DESC;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION mesaclik.get_queue_entries(UUID, INTEGER) TO anon, authenticated;
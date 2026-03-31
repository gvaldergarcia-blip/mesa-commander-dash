-- Drop and recreate get_queue_entries with queue_type
DROP FUNCTION IF EXISTS mesaclik.get_queue_entries(UUID, INTEGER);

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
  updated_at TIMESTAMPTZ,
  queue_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'mesaclik', 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING errcode = '28000';
  END IF;
  IF NOT public.is_member_or_admin(p_restaurant_id) THEN
    RAISE EXCEPTION 'Acesso negado a este restaurante' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    qe.id AS entry_id, qe.queue_id,
    qe.name AS customer_name, qe.phone,
    COALESCE(qe.email, '') AS email,
    qe.party_size AS people, qe.status::TEXT, qe.notes,
    COALESCE(qe.position, 0)::INTEGER AS queue_position,
    qe.called_at, qe.seated_at, qe.canceled_at,
    qe.created_at, qe.updated_at,
    COALESCE(q.queue_type, 'normal') AS queue_type
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE q.restaurant_id = p_restaurant_id
    AND qe.created_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  ORDER BY qe.created_at DESC;
END;
$$;
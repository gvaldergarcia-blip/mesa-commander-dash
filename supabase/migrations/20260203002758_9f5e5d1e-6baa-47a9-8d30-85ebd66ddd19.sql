-- Update get_queue_entries to exclude 'cleared' entries from the dashboard view
DROP FUNCTION IF EXISTS mesaclik.get_queue_entries(uuid, integer);

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
    qe.id AS entry_id,
    qe.queue_id,
    qe.customer_name,
    COALESCE(qe.phone, '—') AS phone,
    COALESCE(c.email, '—') AS email,
    qe.party_size AS people,
    qe.status::text,
    qe.notes,
    qe.position_number AS "position",
    qe.called_at,
    qe.seated_at,
    qe.canceled_at,
    qe.created_at,
    qe.updated_at
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  LEFT JOIN public.customers c ON c.id = qe.customer_id
  WHERE q.restaurant_id = p_restaurant_id
    AND qe.created_at >= (now() - (p_hours_back || ' hours')::interval)
    AND qe.status != 'cleared'
  ORDER BY qe.created_at ASC;
END;
$$;
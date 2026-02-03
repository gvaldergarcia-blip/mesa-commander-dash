-- Fix 1: Grant EXECUTE permission on add_customer_to_queue to anon and authenticated
GRANT EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text) TO anon, authenticated;

-- Fix 2: Recreate get_queue_entries without referencing non-existent customer_id column
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
    qe.customer_name,
    qe.phone,
    COALESCE(qe.phone, '') as email,
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

-- Grant execute on get_queue_entries
GRANT EXECUTE ON FUNCTION mesaclik.get_queue_entries(uuid, integer) TO anon, authenticated;
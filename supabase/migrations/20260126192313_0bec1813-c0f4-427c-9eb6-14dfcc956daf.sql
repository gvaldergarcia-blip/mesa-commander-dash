-- Criar função RPC para buscar entradas da fila (bypassa RLS para o dashboard)
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
  status mesaclik.queue_status,
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
SET search_path = public, mesaclik
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qe.id AS entry_id,
    qe.queue_id,
    qe.name AS customer_name,
    qe.phone,
    qe.email,
    qe.party_size AS people,
    qe.status,
    qe.notes,
    qe.position,
    qe.called_at,
    qe.seated_at,
    qe.canceled_at,
    qe.created_at,
    qe.updated_at
  FROM mesaclik.queue_entries qe
  WHERE qe.restaurant_id = p_restaurant_id
    AND qe.created_at >= (NOW() - (p_hours_back || ' hours')::interval)
  ORDER BY qe.created_at ASC;
END;
$$;

-- Permitir que anon e authenticated chamem esta função
GRANT EXECUTE ON FUNCTION mesaclik.get_queue_entries(uuid, integer) TO anon;
GRANT EXECUTE ON FUNCTION mesaclik.get_queue_entries(uuid, integer) TO authenticated;
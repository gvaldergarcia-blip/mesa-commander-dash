-- RPC para buscar histórico completo de queue_entries por email
CREATE OR REPLACE FUNCTION public.get_customer_queue_history(
  p_restaurant_id uuid,
  p_email text DEFAULT '',
  p_phone text DEFAULT ''
)
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  phone text,
  party_size integer,
  status text,
  created_at timestamptz,
  called_at timestamptz,
  seated_at timestamptz,
  canceled_at timestamptz,
  wait_time_min integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
  SELECT 
    qe.id,
    qe.name,
    qe.email,
    qe.phone,
    qe.party_size,
    qe.status::text,
    qe.created_at,
    qe.called_at,
    qe.seated_at,
    qe.canceled_at,
    qe.wait_time_min
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE q.restaurant_id = p_restaurant_id
    AND (
      (p_email != '' AND qe.email = p_email)
      OR (p_phone != '' AND p_phone != '—' AND qe.phone = p_phone)
    )
  ORDER BY qe.created_at DESC
  LIMIT 100;
$$;

-- RPC para buscar histórico completo de reservations por email
CREATE OR REPLACE FUNCTION public.get_customer_reservation_history(
  p_restaurant_id uuid,
  p_email text DEFAULT '',
  p_phone text DEFAULT ''
)
RETURNS TABLE(
  id uuid,
  name text,
  customer_email text,
  phone text,
  party_size integer,
  status text,
  reserved_for timestamptz,
  created_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  no_show_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
  SELECT 
    r.id,
    r.name,
    r.customer_email,
    r.phone,
    r.party_size,
    r.status::text,
    r.reserved_for,
    r.created_at,
    r.confirmed_at,
    r.completed_at,
    r.canceled_at,
    r.no_show_at
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND (
      (p_email != '' AND r.customer_email = p_email)
      OR (p_phone != '' AND p_phone != '—' AND r.phone = p_phone)
    )
  ORDER BY r.created_at DESC
  LIMIT 100;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_customer_queue_history(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_reservation_history(uuid, text, text) TO anon, authenticated;
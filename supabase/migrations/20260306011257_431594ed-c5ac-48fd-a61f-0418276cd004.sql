-- Drop and recreate with ownership check
DROP FUNCTION IF EXISTS public.get_reports_reservation_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE FUNCTION public.get_reports_reservation_data(
  p_restaurant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  party_size INTEGER,
  phone TEXT,
  created_at TIMESTAMPTZ,
  reserved_for TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  no_show_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
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
    r.id, r.status::text, r.party_size, r.phone,
    r.created_at, r.reservation_datetime as reserved_for,
    r.confirmed_at, r.canceled_at, r.completed_at,
    r.canceled_at as no_show_at
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND r.reservation_datetime >= p_start_date
    AND r.reservation_datetime <= p_end_date
  ORDER BY r.reservation_datetime DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_reports_reservation_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_reports_reservation_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Now the queue data RPC (return type matches, just add ownership)
CREATE OR REPLACE FUNCTION public.get_reports_queue_data(
  p_restaurant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  called_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  status TEXT,
  party_size INTEGER,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
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
    qe.id, qe.created_at, qe.called_at, qe.seated_at,
    qe.canceled_at, qe.status::text, qe.party_size, qe.phone
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE q.restaurant_id = p_restaurant_id
    AND qe.created_at >= p_start_date
    AND qe.created_at <= p_end_date
  ORDER BY qe.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_reports_queue_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_reports_queue_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- get_queue_entries
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING errcode = '28000';
  END IF;
  IF NOT public.is_member_or_admin(p_restaurant_id) THEN
    RAISE EXCEPTION 'Acesso negado a este restaurante' USING errcode = '42501';
  END IF;

  SELECT q.id INTO v_queue_id
  FROM mesaclik.queues q
  WHERE q.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF v_queue_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT 
    qe.id AS entry_id, qe.queue_id,
    qe.name AS customer_name, qe.phone,
    COALESCE(qe.email, '') AS email,
    qe.party_size AS people, qe.status::TEXT, qe.notes,
    COALESCE(qe.position, 0)::INTEGER AS queue_position,
    qe.called_at, qe.seated_at, qe.canceled_at,
    qe.created_at, qe.updated_at
  FROM mesaclik.queue_entries qe
  WHERE qe.queue_id = v_queue_id
    AND qe.created_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  ORDER BY qe.created_at DESC;
END;
$$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION mesaclik.get_queue_entries(UUID, INTEGER) FROM anon;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION mesaclik.get_queue_entries(UUID, INTEGER) TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Also revoke 1-param versions
REVOKE EXECUTE ON FUNCTION public.get_reports_queue_data(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_reports_reservation_data(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_reports_queue_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reports_reservation_data(UUID) TO authenticated;
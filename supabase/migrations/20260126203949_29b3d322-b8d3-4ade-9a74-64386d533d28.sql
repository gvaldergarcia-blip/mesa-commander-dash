-- =============================================================
-- RPC FUNCTION: get_reports_queue_data
-- Função SECURITY DEFINER para buscar dados de fila para relatórios
-- Bypassa RLS para permitir que owners vejam dados do restaurante
-- =============================================================

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
  RETURN QUERY
  SELECT 
    qe.id,
    qe.created_at,
    qe.called_at,
    qe.seated_at,
    qe.canceled_at,
    qe.status::text,
    qe.party_size,
    qe.phone
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE q.restaurant_id = p_restaurant_id
    AND qe.created_at >= p_start_date
    AND qe.created_at <= p_end_date
  ORDER BY qe.created_at DESC;
END;
$$;

-- =============================================================
-- RPC FUNCTION: get_reports_reservation_data
-- Função SECURITY DEFINER para buscar dados de reservas para relatórios
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_reports_reservation_data(
  p_restaurant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  reserved_for TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  no_show_at TIMESTAMPTZ,
  status TEXT,
  party_size INTEGER,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.created_at,
    r.reservation_datetime as reserved_for,
    r.confirmed_at,
    r.completed_at,
    r.canceled_at,
    r.canceled_at as no_show_at, -- usando canceled_at como proxy para no_show
    r.status::text,
    r.party_size,
    r.phone
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND r.reservation_datetime >= p_start_date
    AND r.reservation_datetime <= p_end_date
  ORDER BY r.reservation_datetime DESC;
END;
$$;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_reports_queue_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_reports_reservation_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, anon;
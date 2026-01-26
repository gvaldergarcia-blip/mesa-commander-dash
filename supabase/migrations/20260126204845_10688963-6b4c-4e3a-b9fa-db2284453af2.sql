-- Dropar e recriar a função com o tipo correto
DROP FUNCTION IF EXISTS public.get_reports_reservation_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_reports_reservation_data(
  p_restaurant_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  party_size INT,
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
  RETURN QUERY
  SELECT 
    r.id,
    r.status::TEXT,
    r.party_size,
    r.phone,
    r.created_at,
    r.reservation_datetime as reserved_for,
    NULL::TIMESTAMPTZ as confirmed_at,
    r.canceled_at,
    NULL::TIMESTAMPTZ as completed_at,
    NULL::TIMESTAMPTZ as no_show_at
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND r.reservation_datetime >= p_start_date
    AND r.reservation_datetime <= p_end_date;
END;
$$;
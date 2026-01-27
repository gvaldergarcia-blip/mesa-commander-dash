-- Corrigir a função RPC para usar as colunas corretas da tabela mesaclik.reservations
CREATE OR REPLACE FUNCTION public.get_reports_reservation_data(
  p_restaurant_id uuid, 
  p_start_date timestamp with time zone, 
  p_end_date timestamp with time zone
)
RETURNS TABLE(
  id uuid, 
  status text, 
  party_size integer, 
  phone text, 
  created_at timestamp with time zone, 
  reserved_for timestamp with time zone, 
  confirmed_at timestamp with time zone, 
  canceled_at timestamp with time zone, 
  completed_at timestamp with time zone, 
  no_show_at timestamp with time zone
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
    r.reserved_for,
    r.confirmed_at,
    r.canceled_at,
    r.completed_at,
    r.no_show_at
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND r.reserved_for >= p_start_date
    AND r.reserved_for <= p_end_date;
END;
$$;
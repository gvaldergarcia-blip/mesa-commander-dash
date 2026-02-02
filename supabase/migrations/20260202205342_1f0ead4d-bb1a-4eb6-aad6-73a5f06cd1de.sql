-- RPC para buscar reservas do painel (sem problemas de RLS)
CREATE OR REPLACE FUNCTION public.get_reservations_panel(p_restaurant_id UUID)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  user_id UUID,
  name TEXT,
  customer_email TEXT,
  phone TEXT,
  party_size INTEGER,
  reserved_for TIMESTAMPTZ,
  status mesaclik.reservation_status,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  no_show_at TIMESTAMPTZ,
  canceled_by TEXT,
  cancel_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
BEGIN
  -- Validar que o restaurante existe
  IF NOT EXISTS (SELECT 1 FROM mesaclik.restaurants WHERE mesaclik.restaurants.id = p_restaurant_id) THEN
    RAISE EXCEPTION 'restaurant not found';
  END IF;

  RETURN QUERY
  SELECT 
    r.id,
    r.restaurant_id,
    r.user_id,
    r.name,
    r.customer_email,
    r.phone,
    r.party_size,
    r.reserved_for,
    r.status,
    r.notes,
    r.created_at,
    r.updated_at,
    r.confirmed_at,
    r.completed_at,
    r.canceled_at,
    r.no_show_at,
    r.canceled_by,
    r.cancel_reason
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = p_restaurant_id
  ORDER BY r.reserved_for ASC;
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_reservations_panel(UUID) TO anon, authenticated;
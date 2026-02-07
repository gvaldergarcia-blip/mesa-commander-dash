-- Dropar e recriar função get_reservations_panel para usar schema public
DROP FUNCTION IF EXISTS public.get_reservations_panel(uuid);

CREATE OR REPLACE FUNCTION public.get_reservations_panel(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid,
  restaurant_id uuid,
  user_id uuid,
  name text,
  customer_email text,
  phone text,
  party_size integer,
  reserved_for timestamptz,
  status public.reservation_status,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  no_show_at timestamptz,
  canceled_by text,
  cancel_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar que o restaurante existe no schema PUBLIC
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE public.restaurants.id = p_restaurant_id) THEN
    RAISE EXCEPTION 'restaurant not found';
  END IF;

  RETURN QUERY
  SELECT 
    r.id,
    r.restaurant_id,
    r.user_id,
    r.customer_name as name,
    r.customer_email,
    r.phone,
    r.party_size,
    r.reservation_datetime as reserved_for,
    r.status,
    r.notes,
    r.created_at,
    r.updated_at,
    NULL::timestamptz as confirmed_at,
    NULL::timestamptz as completed_at,
    r.canceled_at,
    NULL::timestamptz as no_show_at,
    r.canceled_by,
    r.cancel_reason
  FROM public.reservations r
  WHERE r.restaurant_id = p_restaurant_id
  ORDER BY r.reservation_datetime ASC;
END;
$$;
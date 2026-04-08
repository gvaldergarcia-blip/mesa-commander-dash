
DROP FUNCTION IF EXISTS public.get_reports_reservation_data(uuid, timestamptz, timestamptz);

CREATE FUNCTION public.get_reports_reservation_data(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  user_id uuid,
  name text,
  customer_email text,
  phone text,
  party_size int,
  reserved_for timestamptz,
  status text,
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING errcode = '28000';
  END IF;
  IF NOT public.is_member_or_admin(p_restaurant_id) THEN
    RAISE EXCEPTION 'Acesso negado a este restaurante' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.restaurant_id, r.user_id, r.name,
    r.customer_email, r.phone, r.party_size,
    r.reserved_for, r.status::text, r.notes,
    r.created_at, r.updated_at,
    r.confirmed_at, r.completed_at,
    r.canceled_at, r.no_show_at,
    r.canceled_by, r.cancel_reason
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND r.reserved_for >= p_start_date
    AND r.reserved_for <= p_end_date
  ORDER BY r.reserved_for DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_reports_reservation_data(uuid, timestamptz, timestamptz) FROM anon;


CREATE OR REPLACE FUNCTION public.get_reservations_panel(p_restaurant_id uuid)
 RETURNS TABLE(id uuid, restaurant_id uuid, user_id uuid, name text, customer_email text, phone text, party_size integer, reserved_for timestamp with time zone, status reservation_status, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, confirmed_at timestamp with time zone, completed_at timestamp with time zone, canceled_at timestamp with time zone, no_show_at timestamp with time zone, canceled_by text, cancel_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'mesaclik'
AS $function$
BEGIN
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
    (r.status::text)::public.reservation_status,
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
$function$;

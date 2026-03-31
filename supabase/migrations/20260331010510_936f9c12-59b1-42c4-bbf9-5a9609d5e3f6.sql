CREATE OR REPLACE FUNCTION public.create_reservation_panel(
  p_restaurant_id uuid,
  p_name text,
  p_customer_phone text DEFAULT NULL::text,
  p_customer_email text DEFAULT NULL::text,
  p_reserved_for timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_party_size integer DEFAULT 1,
  p_notes text DEFAULT NULL::text
)
RETURNS mesaclik.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $function$
DECLARE
  v_row mesaclik.reservations;
  v_email text;
  v_phone_digits text;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id is required' USING errcode = '22023';
  END IF;

  IF NOT mesaclik.restaurant_exists(p_restaurant_id) THEN
    RAISE EXCEPTION 'restaurant not found' USING errcode = '22023';
  END IF;

  v_phone_digits := NULLIF(regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g'), '');

  IF v_phone_digits IS NULL THEN
    RAISE EXCEPTION 'customer_phone is required' USING errcode = '22023';
  END IF;

  IF length(v_phone_digits) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'customer_phone must have 10 or 11 digits' USING errcode = '22023';
  END IF;

  IF p_party_size IS NULL OR p_party_size < 1 THEN
    RAISE EXCEPTION 'party_size is invalid' USING errcode = '22023';
  END IF;

  IF p_reserved_for IS NULL THEN
    RAISE EXCEPTION 'reserved_for is required' USING errcode = '22023';
  END IF;

  v_email := NULLIF(trim(COALESCE(p_customer_email, '')), '');

  INSERT INTO mesaclik.reservations (
    restaurant_id,
    user_id,
    name,
    customer_email,
    phone,
    party_size,
    reserved_for,
    notes,
    status
  )
  VALUES (
    p_restaurant_id,
    p_restaurant_id,
    NULLIF(trim(p_name), ''),
    v_email,
    v_phone_digits,
    p_party_size,
    p_reserved_for,
    NULLIF(trim(p_notes), ''),
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
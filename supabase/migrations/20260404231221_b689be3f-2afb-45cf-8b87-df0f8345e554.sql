
CREATE OR REPLACE FUNCTION public.get_loyalty_tracking(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status record;
  v_program record;
  v_customer record;
  v_restaurant record;
BEGIN
  IF p_token IS NULL OR TRIM(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;

  SELECT * INTO v_status
  FROM public.customer_loyalty_status
  WHERE loyalty_token = p_token;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Programa não encontrado');
  END IF;

  SELECT * INTO v_program
  FROM public.restaurant_loyalty_program
  WHERE restaurant_id = v_status.restaurant_id
    AND is_active = true;

  IF v_program IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Programa não está ativo');
  END IF;

  SELECT customer_name, customer_email, customer_phone INTO v_customer
  FROM public.restaurant_customers
  WHERE id = v_status.customer_id;

  -- Read from mesaclik.restaurants (where settings are saved)
  SELECT r.name, r.image_url, r.address_line, r.city, r.cuisine::text as cuisine, r.menu_url, r.about
  INTO v_restaurant
  FROM mesaclik.restaurants r
  WHERE r.id = v_status.restaurant_id;

  -- Fallback to public.restaurants if not found in mesaclik
  IF v_restaurant IS NULL THEN
    SELECT r.name, r.image_url, r.address_line, r.city, r.cuisine::text as cuisine, r.menu_url, r.about
    INTO v_restaurant
    FROM public.restaurants r
    WHERE r.id = v_status.restaurant_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'customer', jsonb_build_object(
      'name', COALESCE(v_customer.customer_name, 'Cliente'),
      'current_visits', COALESCE(v_status.custom_required_visits, v_program.required_visits) - (COALESCE(v_status.custom_required_visits, v_program.required_visits) - v_status.current_visits),
      'current_visits_raw', v_status.current_visits
    ),
    'program', jsonb_build_object(
      'name', v_program.program_name,
      'required_visits', COALESCE(v_status.custom_required_visits, v_program.required_visits),
      'reward_description', COALESCE(v_status.custom_reward_description, v_program.reward_description),
      'reward_validity_days', COALESCE(v_status.custom_reward_validity_days, v_program.reward_validity_days),
      'reward_unlocked', v_status.reward_unlocked,
      'reward_unlocked_at', v_status.reward_unlocked_at,
      'reward_expires_at', v_status.reward_expires_at
    ),
    'restaurant', jsonb_build_object(
      'name', v_restaurant.name,
      'image_url', v_restaurant.image_url,
      'address', COALESCE(v_restaurant.address_line, '') || CASE WHEN v_restaurant.city IS NOT NULL THEN ', ' || v_restaurant.city ELSE '' END,
      'cuisine', v_restaurant.cuisine,
      'menu_url', v_restaurant.menu_url,
      'about', v_restaurant.about
    )
  );
END;
$$;

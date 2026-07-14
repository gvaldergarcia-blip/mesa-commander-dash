
CREATE OR REPLACE FUNCTION public.set_customer_location_consent(
  p_token text,
  p_latitude numeric,
  p_longitude numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_restaurant_id uuid;
BEGIN
  SELECT id, restaurant_id INTO v_customer_id, v_restaurant_id
  FROM public.restaurant_customers
  WHERE unsubscribe_token = p_token
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  UPDATE public.restaurant_customers
     SET location_consent = true,
         location_consent_at = now()
   WHERE id = v_customer_id;

  RETURN jsonb_build_object('success', true, 'restaurant_id', v_restaurant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_gps_visit(
  p_customer_token text,
  p_latitude numeric,
  p_longitude numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_restaurant_id uuid;
  v_rest_lat numeric;
  v_rest_lng numeric;
  v_radius integer;
  v_dist_m numeric;
  v_last timestamptz;
BEGIN
  SELECT rc.id, rc.restaurant_id, rc.last_gps_visit_at,
         r.latitude, r.longitude, r.gps_geofence_radius_m
    INTO v_customer_id, v_restaurant_id, v_last, v_rest_lat, v_rest_lng, v_radius
    FROM public.restaurant_customers rc
    JOIN public.restaurants r ON r.id = rc.restaurant_id
   WHERE rc.unsubscribe_token = p_customer_token
     AND rc.location_consent = true
   LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_consented');
  END IF;
  IF v_rest_lat IS NULL OR v_rest_lng IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'restaurant_no_coords');
  END IF;

  v_dist_m := 2 * 6371000 * asin(
    sqrt(
      power(sin(radians((p_latitude - v_rest_lat)/2)), 2) +
      cos(radians(v_rest_lat)) * cos(radians(p_latitude)) *
      power(sin(radians((p_longitude - v_rest_lng)/2)), 2)
    )
  );

  IF v_dist_m > COALESCE(v_radius, 80) THEN
    RETURN jsonb_build_object('success', false, 'error', 'out_of_range', 'distance_m', round(v_dist_m));
  END IF;

  IF v_last IS NOT NULL AND v_last > now() - interval '3 hours' THEN
    RETURN jsonb_build_object('success', false, 'error', 'recent_visit');
  END IF;

  INSERT INTO public.customer_visits (restaurant_id, customer_id, visit_date, source)
  VALUES (v_restaurant_id, v_customer_id, now(), 'gps');

  UPDATE public.restaurant_customers
     SET last_gps_visit_at = now()
   WHERE id = v_customer_id;

  RETURN jsonb_build_object('success', true, 'distance_m', round(v_dist_m));
END;
$$;

CREATE OR REPLACE FUNCTION public.qr_get_restaurant_info(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_logo text;
  v_active boolean;
  v_max_party_size integer;
BEGIN
  SELECT r.name, r.image_url,
    (r.plan_status IN ('trial', 'ativo'))
  INTO v_name, v_logo, v_active
  FROM mesaclik.restaurants r
  WHERE r.id = p_restaurant_id;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  IF NOT v_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante inativo');
  END IF;

  -- Fetch max_party_size from queue settings
  SELECT qs.max_party_size INTO v_max_party_size
  FROM mesaclik.queue_settings qs
  WHERE qs.restaurant_id = p_restaurant_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'name', v_name,
    'logo_url', v_logo,
    'max_party_size', COALESCE(v_max_party_size, 8)
  );
END;
$function$;
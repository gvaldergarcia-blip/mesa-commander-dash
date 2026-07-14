
-- =========================================================
-- FRENTE 1: Etiquetas Autônomas
-- =========================================================
ALTER TABLE public.label_products
  ADD COLUMN IF NOT EXISTS auto_reprint_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_discharge_after_hours integer;

CREATE TABLE IF NOT EXISTS public.label_reprint_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  label_product_id uuid NOT NULL REFERENCES public.label_products(id) ON DELETE CASCADE,
  source_label_id uuid REFERENCES public.label_issuances(id) ON DELETE SET NULL,
  suggested_at timestamptz NOT NULL DEFAULT now(),
  suggested_reason text NOT NULL DEFAULT 'discharge',
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_reprint_queue TO authenticated;
GRANT ALL ON public.label_reprint_queue TO service_role;

ALTER TABLE public.label_reprint_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reprint_queue_member_all"
  ON public.label_reprint_queue
  FOR ALL TO authenticated
  USING (public.is_member_or_admin(restaurant_id))
  WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE INDEX IF NOT EXISTS idx_reprint_queue_restaurant_status
  ON public.label_reprint_queue(restaurant_id, status);

-- Trigger: quando etiqueta vira 'discharged' e produto tem auto_reprint_enabled, enfileirar
CREATE OR REPLACE FUNCTION public.enqueue_label_reprint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto boolean;
BEGIN
  IF NEW.status = 'discharged'
     AND (OLD.status IS NULL OR OLD.status <> 'discharged')
     AND NEW.label_product_id IS NOT NULL THEN
    SELECT auto_reprint_enabled INTO v_auto
      FROM public.label_products
      WHERE id = NEW.label_product_id;
    IF COALESCE(v_auto, false) THEN
      -- evitar duplicidade: só cria se não há pending para o mesmo produto na última 1h
      IF NOT EXISTS (
        SELECT 1 FROM public.label_reprint_queue
        WHERE label_product_id = NEW.label_product_id
          AND status = 'pending'
          AND suggested_at > now() - interval '1 hour'
      ) THEN
        INSERT INTO public.label_reprint_queue
          (restaurant_id, label_product_id, source_label_id, suggested_reason)
        VALUES
          (NEW.restaurant_id, NEW.label_product_id, NEW.id, 'discharge');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_label_reprint ON public.label_issuances;
CREATE TRIGGER trg_enqueue_label_reprint
AFTER UPDATE OF status ON public.label_issuances
FOR EACH ROW EXECUTE FUNCTION public.enqueue_label_reprint();

-- =========================================================
-- FRENTE 2: Visitas por GPS
-- =========================================================
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS gps_geofence_radius_m integer NOT NULL DEFAULT 80;

ALTER TABLE public.restaurant_customers
  ADD COLUMN IF NOT EXISTS location_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_gps_visit_at timestamptz;

-- RPC pública (opt-in) para registrar consentimento de localização + coords do momento
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
  -- Reaproveita mesmo padrão de opt-in por token
  SELECT id, restaurant_id INTO v_customer_id, v_restaurant_id
  FROM public.restaurant_customers
  WHERE marketing_optin_token = p_token
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

GRANT EXECUTE ON FUNCTION public.set_customer_location_consent(text, numeric, numeric) TO anon, authenticated;

-- RPC pública para registrar visita GPS (validação de distância server-side)
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
   WHERE rc.marketing_optin_token = p_customer_token
     AND rc.location_consent = true
   LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_consented');
  END IF;
  IF v_rest_lat IS NULL OR v_rest_lng IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'restaurant_no_coords');
  END IF;

  -- Haversine em metros
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

  -- Debounce: 1 visita GPS por customer a cada 3h
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

GRANT EXECUTE ON FUNCTION public.register_gps_visit(text, numeric, numeric) TO anon, authenticated;

-- =========================================================
-- FRENTE 3: Studio Autopilot
-- =========================================================
CREATE TABLE IF NOT EXISTS public.studio_autopilot_settings (
  restaurant_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  auto_publish boolean NOT NULL DEFAULT false,
  weekly_target integer NOT NULL DEFAULT 3,
  categories text[] NOT NULL DEFAULT '{}'::text[],
  last_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_autopilot_settings TO authenticated;
GRANT ALL ON public.studio_autopilot_settings TO service_role;
ALTER TABLE public.studio_autopilot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autopilot_settings_member_all"
  ON public.studio_autopilot_settings
  FOR ALL TO authenticated
  USING (public.is_member_or_admin(restaurant_id))
  WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE TABLE IF NOT EXISTS public.studio_weekly_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  dish_id uuid,
  dish_name text,
  suggested_copy text NOT NULL,
  suggested_hashtags text,
  suggested_publish_at timestamptz,
  image_url text,
  reuses_asset_id uuid,
  status text NOT NULL DEFAULT 'pending',
  week_of date NOT NULL DEFAULT date_trunc('week', now())::date,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_weekly_suggestions TO authenticated;
GRANT ALL ON public.studio_weekly_suggestions TO service_role;
ALTER TABLE public.studio_weekly_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_suggestions_member_all"
  ON public.studio_weekly_suggestions
  FOR ALL TO authenticated
  USING (public.is_member_or_admin(restaurant_id))
  WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE INDEX IF NOT EXISTS idx_weekly_suggestions_restaurant_status
  ON public.studio_weekly_suggestions(restaurant_id, status, week_of);

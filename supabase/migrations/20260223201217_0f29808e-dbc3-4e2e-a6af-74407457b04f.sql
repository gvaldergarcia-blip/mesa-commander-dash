
-- 1. Adicionar colunas de versionamento de termos
ALTER TABLE public.restaurant_customers 
  ADD COLUMN IF NOT EXISTS terms_version text DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS privacy_version text DEFAULT 'v1';

-- 2. Atualizar a RPC para aceitar source 'app' e versões de termos
CREATE OR REPLACE FUNCTION public.upsert_restaurant_customer(
  p_restaurant_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'manual',
  p_marketing_optin BOOLEAN DEFAULT NULL,
  p_terms_accepted BOOLEAN DEFAULT NULL,
  p_terms_version TEXT DEFAULT 'v1',
  p_privacy_version TEXT DEFAULT 'v1'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_sanitized_email TEXT;
  v_sanitized_name TEXT;
  v_sanitized_phone TEXT;
BEGIN
  -- ========== INPUT VALIDATION ==========
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required' USING errcode = '22023';
  END IF;
  
  v_sanitized_email := LOWER(TRIM(p_email));
  
  IF LENGTH(v_sanitized_email) > 320 THEN
    RAISE EXCEPTION 'Email too long (max 320 characters)' USING errcode = '22023';
  END IF;
  
  IF v_sanitized_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format' USING errcode = '22023';
  END IF;
  
  v_sanitized_name := NULLIF(TRIM(p_name), '');
  IF v_sanitized_name IS NOT NULL AND LENGTH(v_sanitized_name) > 255 THEN
    RAISE EXCEPTION 'Name too long (max 255 characters)' USING errcode = '22023';
  END IF;
  
  v_sanitized_phone := NULLIF(TRIM(p_phone), '');
  IF v_sanitized_phone IS NOT NULL AND LENGTH(v_sanitized_phone) > 50 THEN
    RAISE EXCEPTION 'Phone too long (max 50 characters)' USING errcode = '22023';
  END IF;
  
  -- Aceitar 'app' como source válido
  IF p_source NOT IN ('queue', 'reservation', 'manual', 'import', 'app') THEN
    RAISE EXCEPTION 'Invalid source value' USING errcode = '22023';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Restaurant not found' USING errcode = '22023';
  END IF;
  
  -- ========== BUSINESS LOGIC ==========
  INSERT INTO public.restaurant_customers (
    restaurant_id, customer_email, customer_name, customer_phone,
    last_seen_at, opt_in_source,
    total_queue_visits, total_reservation_visits,
    marketing_optin, marketing_optin_at,
    terms_accepted, terms_accepted_at,
    terms_version, privacy_version
  )
  VALUES (
    p_restaurant_id, v_sanitized_email, v_sanitized_name, v_sanitized_phone,
    NOW(), p_source,
    CASE WHEN p_source = 'queue' THEN 1 ELSE 0 END,
    CASE WHEN p_source = 'reservation' THEN 1 ELSE 0 END,
    COALESCE(p_marketing_optin, false),
    CASE WHEN p_marketing_optin = true THEN NOW() ELSE NULL END,
    COALESCE(p_terms_accepted, false),
    CASE WHEN p_terms_accepted = true THEN NOW() ELSE NULL END,
    p_terms_version, p_privacy_version
  )
  ON CONFLICT (restaurant_id, customer_email) DO UPDATE SET
    customer_name = COALESCE(NULLIF(TRIM(EXCLUDED.customer_name), ''), restaurant_customers.customer_name),
    customer_phone = COALESCE(NULLIF(TRIM(EXCLUDED.customer_phone), ''), restaurant_customers.customer_phone),
    last_seen_at = NOW(),
    opt_in_source = COALESCE(p_source, restaurant_customers.opt_in_source),
    total_queue_visits = restaurant_customers.total_queue_visits + CASE WHEN p_source = 'queue' THEN 1 ELSE 0 END,
    total_reservation_visits = restaurant_customers.total_reservation_visits + CASE WHEN p_source = 'reservation' THEN 1 ELSE 0 END,
    marketing_optin = CASE 
      WHEN p_marketing_optin IS NOT NULL THEN p_marketing_optin 
      ELSE restaurant_customers.marketing_optin 
    END,
    marketing_optin_at = CASE 
      WHEN p_marketing_optin = true AND restaurant_customers.marketing_optin = false THEN NOW()
      WHEN p_marketing_optin = false THEN NULL
      ELSE restaurant_customers.marketing_optin_at 
    END,
    terms_accepted = CASE 
      WHEN p_terms_accepted IS NOT NULL THEN p_terms_accepted 
      ELSE restaurant_customers.terms_accepted 
    END,
    terms_accepted_at = CASE 
      WHEN p_terms_accepted = true AND restaurant_customers.terms_accepted = false THEN NOW()
      ELSE restaurant_customers.terms_accepted_at 
    END,
    terms_version = COALESCE(p_terms_version, restaurant_customers.terms_version),
    privacy_version = COALESCE(p_privacy_version, restaurant_customers.privacy_version),
    status = 'active',
    vip = CASE 
      WHEN (restaurant_customers.total_queue_visits + restaurant_customers.total_reservation_visits + 1) >= 10 THEN true
      ELSE restaurant_customers.vip 
    END
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$;

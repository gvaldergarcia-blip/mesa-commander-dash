
-- Add consent tracking columns to restaurant_customers
ALTER TABLE public.restaurant_customers
  ADD COLUMN IF NOT EXISTS opt_in_source text,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_token text DEFAULT gen_random_uuid()::text;

-- Backfill existing opt-in customers
UPDATE public.restaurant_customers
SET opt_in_source = 'legacy'
WHERE marketing_optin = true AND opt_in_source IS NULL;

-- Backfill unsubscribe tokens for all existing rows
UPDATE public.restaurant_customers
SET unsubscribe_token = gen_random_uuid()::text
WHERE unsubscribe_token IS NULL;

-- Update upsert_restaurant_customer to support opt_in_source
CREATE OR REPLACE FUNCTION public.upsert_restaurant_customer(
  p_restaurant_id uuid,
  p_email text,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_source text DEFAULT 'queue',
  p_marketing_optin boolean DEFAULT NULL,
  p_terms_accepted boolean DEFAULT NULL,
  p_opt_in_source text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
  v_sanitized_email TEXT;
  v_sanitized_name TEXT;
  v_sanitized_phone TEXT;
BEGIN
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
  
  IF p_source NOT IN ('queue', 'reservation', 'manual', 'import') THEN
    RAISE EXCEPTION 'Invalid source value' USING errcode = '22023';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Restaurant not found' USING errcode = '22023';
  END IF;
  
  INSERT INTO public.restaurant_customers (
    restaurant_id,
    customer_email,
    customer_name,
    customer_phone,
    last_seen_at,
    total_queue_visits,
    total_reservation_visits,
    marketing_optin,
    marketing_optin_at,
    opt_in_source,
    terms_accepted,
    terms_accepted_at,
    unsubscribe_token
  )
  VALUES (
    p_restaurant_id,
    v_sanitized_email,
    v_sanitized_name,
    v_sanitized_phone,
    NOW(),
    CASE WHEN p_source = 'queue' THEN 1 ELSE 0 END,
    CASE WHEN p_source = 'reservation' THEN 1 ELSE 0 END,
    COALESCE(p_marketing_optin, false),
    CASE WHEN p_marketing_optin = true THEN NOW() ELSE NULL END,
    CASE WHEN p_marketing_optin = true THEN COALESCE(p_opt_in_source, 'manual_by_restaurant') ELSE NULL END,
    COALESCE(p_terms_accepted, false),
    CASE WHEN p_terms_accepted = true THEN NOW() ELSE NULL END,
    gen_random_uuid()::text
  )
  ON CONFLICT (restaurant_id, customer_email) DO UPDATE SET
    customer_name = COALESCE(NULLIF(TRIM(EXCLUDED.customer_name), ''), restaurant_customers.customer_name),
    customer_phone = COALESCE(NULLIF(TRIM(EXCLUDED.customer_phone), ''), restaurant_customers.customer_phone),
    last_seen_at = NOW(),
    total_queue_visits = restaurant_customers.total_queue_visits + CASE WHEN p_source = 'queue' THEN 1 ELSE 0 END,
    total_reservation_visits = restaurant_customers.total_reservation_visits + CASE WHEN p_source = 'reservation' THEN 1 ELSE 0 END,
    marketing_optin = CASE 
      WHEN p_marketing_optin IS NOT NULL THEN p_marketing_optin 
      ELSE restaurant_customers.marketing_optin 
    END,
    marketing_optin_at = CASE 
      WHEN p_marketing_optin = true AND restaurant_customers.marketing_optin = false THEN NOW()
      ELSE restaurant_customers.marketing_optin_at 
    END,
    opt_in_source = CASE
      WHEN p_marketing_optin = true AND restaurant_customers.marketing_optin = false THEN COALESCE(p_opt_in_source, 'manual_by_restaurant')
      ELSE restaurant_customers.opt_in_source
    END,
    unsubscribed_at = CASE
      WHEN p_marketing_optin = true THEN NULL
      ELSE restaurant_customers.unsubscribed_at
    END,
    terms_accepted = CASE 
      WHEN p_terms_accepted IS NOT NULL THEN p_terms_accepted 
      ELSE restaurant_customers.terms_accepted 
    END,
    terms_accepted_at = CASE 
      WHEN p_terms_accepted = true AND restaurant_customers.terms_accepted = false THEN NOW()
      ELSE restaurant_customers.terms_accepted_at 
    END,
    status = 'active',
    vip = CASE 
      WHEN (restaurant_customers.total_queue_visits + restaurant_customers.total_reservation_visits + 1) >= 10 THEN true
      ELSE restaurant_customers.vip 
    END
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$;

-- RPC to confirm marketing opt-in via token
CREATE OR REPLACE FUNCTION public.confirm_marketing_optin(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
  v_customer_name TEXT;
  v_restaurant_name TEXT;
BEGIN
  IF p_token IS NULL OR TRIM(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;

  UPDATE public.restaurant_customers
  SET 
    marketing_optin = true,
    marketing_optin_at = NOW(),
    opt_in_source = 'email_confirm',
    unsubscribed_at = NULL
  WHERE unsubscribe_token = p_token
    AND marketing_optin = false
  RETURNING id, customer_name INTO v_customer_id, v_customer_name;

  IF v_customer_id IS NULL THEN
    -- Check if already opted in
    SELECT id, customer_name INTO v_customer_id, v_customer_name
    FROM public.restaurant_customers
    WHERE unsubscribe_token = p_token AND marketing_optin = true;
    
    IF v_customer_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_opted_in', true, 'name', v_customer_name);
    END IF;
    
    RETURN jsonb_build_object('success', false, 'error', 'Token não encontrado');
  END IF;

  -- Get restaurant name
  SELECT r.name INTO v_restaurant_name
  FROM public.restaurant_customers rc
  JOIN public.restaurants r ON r.id = rc.restaurant_id
  WHERE rc.id = v_customer_id;

  RETURN jsonb_build_object(
    'success', true,
    'name', v_customer_name,
    'restaurant_name', v_restaurant_name
  );
END;
$$;

-- RPC to unsubscribe via token
CREATE OR REPLACE FUNCTION public.marketing_unsubscribe(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
  v_customer_name TEXT;
  v_restaurant_name TEXT;
BEGIN
  IF p_token IS NULL OR TRIM(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;

  UPDATE public.restaurant_customers
  SET 
    marketing_optin = false,
    unsubscribed_at = NOW()
  WHERE unsubscribe_token = p_token
    AND marketing_optin = true
  RETURNING id, customer_name INTO v_customer_id, v_customer_name;

  IF v_customer_id IS NULL THEN
    -- Check if already unsubscribed
    SELECT id, customer_name INTO v_customer_id, v_customer_name
    FROM public.restaurant_customers
    WHERE unsubscribe_token = p_token AND marketing_optin = false;
    
    IF v_customer_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_unsubscribed', true, 'name', v_customer_name);
    END IF;
    
    RETURN jsonb_build_object('success', false, 'error', 'Token não encontrado');
  END IF;

  SELECT r.name INTO v_restaurant_name
  FROM public.restaurant_customers rc
  JOIN public.restaurants r ON r.id = rc.restaurant_id
  WHERE rc.id = v_customer_id;

  RETURN jsonb_build_object(
    'success', true,
    'name', v_customer_name,
    'restaurant_name', v_restaurant_name
  );
END;
$$;

-- Grant anon access to public RPCs (for opt-in/unsubscribe pages)
GRANT EXECUTE ON FUNCTION public.confirm_marketing_optin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_unsubscribe(text) TO anon, authenticated;

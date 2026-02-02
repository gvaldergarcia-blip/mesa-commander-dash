-- ============================================
-- SECURITY HARDENING: Fix 3 Error-Level Issues
-- ============================================
-- 1. INPUT_VALIDATION: Add server-side validation to RPC functions
-- 2. PUBLIC_DATA_EXPOSURE: Remove anonymous policies from restaurant_customers
-- 3. OPEN_ENDPOINTS: Add ownership validation to RPC functions
-- ============================================

-- ============================================
-- FIX #1: Remove overly permissive anonymous policies from restaurant_customers
-- ============================================
DROP POLICY IF EXISTS "restaurant_customers_anon_insert" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_anon_update" ON public.restaurant_customers;

-- ============================================
-- Drop existing function versions to avoid ambiguity
-- ============================================
DROP FUNCTION IF EXISTS mesaclik.update_queue_entry_status_v2(UUID, TEXT);
DROP FUNCTION IF EXISTS mesaclik.update_queue_entry_status_v2(UUID, mesaclik.queue_status);

-- ============================================
-- FIX #2 & #3: Recreate add_customer_to_queue with validation AND ownership check
-- ============================================
CREATE OR REPLACE FUNCTION mesaclik.add_customer_to_queue(
  p_restaurant_id UUID,
  p_queue_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_party_size INTEGER DEFAULT 1,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'mesaclik', 'public'
AS $$
DECLARE
  v_entry_id UUID;
  v_queue_exists BOOLEAN;
  v_phone TEXT := '—';
  v_sanitized_name TEXT;
  v_sanitized_email TEXT;
  v_sanitized_notes TEXT;
BEGIN
  -- ========== INPUT VALIDATION ==========
  
  -- Validate party_size
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tamanho do grupo inválido (deve ser entre 1 e 50)');
  END IF;
  
  -- Validate and sanitize customer_name
  v_sanitized_name := NULLIF(TRIM(p_customer_name), '');
  IF v_sanitized_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome do cliente é obrigatório');
  END IF;
  IF LENGTH(v_sanitized_name) > 255 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome muito longo (máximo 255 caracteres)');
  END IF;
  
  -- Validate and sanitize email
  IF p_customer_email IS NOT NULL AND TRIM(p_customer_email) != '' THEN
    v_sanitized_email := LOWER(TRIM(p_customer_email));
    IF LENGTH(v_sanitized_email) > 320 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Email muito longo (máximo 320 caracteres)');
    END IF;
    IF v_sanitized_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Formato de email inválido');
    END IF;
  END IF;
  
  -- Validate and sanitize notes
  IF p_notes IS NOT NULL THEN
    v_sanitized_notes := NULLIF(TRIM(p_notes), '');
    IF v_sanitized_notes IS NOT NULL AND LENGTH(v_sanitized_notes) > 1000 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Observações muito longas (máximo 1000 caracteres)');
    END IF;
  END IF;
  
  -- ========== AUTHORIZATION CHECK ==========
  -- Verify caller is admin OR owns the restaurant
  IF NOT (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM mesaclik.restaurants r 
      WHERE r.id = p_restaurant_id AND r.owner_id = auth.uid()
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: você não é dono deste restaurante');
  END IF;
  
  -- ========== BUSINESS LOGIC ==========
  
  -- Validate queue exists and belongs to restaurant
  SELECT EXISTS (
    SELECT 1 FROM mesaclik.queues 
    WHERE id = p_queue_id AND restaurant_id = p_restaurant_id
  ) INTO v_queue_exists;
  
  IF NOT v_queue_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fila não encontrada para este restaurante');
  END IF;
  
  -- Insert queue entry
  INSERT INTO mesaclik.queue_entries (
    queue_id,
    name,
    email,
    phone,
    party_size,
    notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_queue_id,
    v_sanitized_name,
    v_sanitized_email,
    v_phone,
    p_party_size,
    v_sanitized_notes,
    'waiting',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_entry_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'entry_id', v_entry_id,
    'message', 'Cliente adicionado à fila com sucesso'
  );
END;
$$;

-- ============================================
-- FIX #2 & #3: Recreate update_queue_entry_status_v2 with ownership check
-- ============================================
CREATE OR REPLACE FUNCTION mesaclik.update_queue_entry_status_v2(
  p_entry_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'mesaclik', 'public'
AS $$
DECLARE
  v_entry RECORD;
  v_status mesaclik.queue_status;
  v_wait_time_min INTEGER;
  v_restaurant_id UUID;
BEGIN
  -- ========== INPUT VALIDATION ==========
  IF p_entry_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID da entrada é obrigatório');
  END IF;
  
  IF p_status IS NULL OR p_status NOT IN ('waiting', 'called', 'seated', 'canceled', 'no_show', 'cleared') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido');
  END IF;
  
  -- Get entry and restaurant info
  SELECT qe.*, q.restaurant_id INTO v_entry
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE qe.id = p_entry_id;
  
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrada da fila não encontrada');
  END IF;
  
  v_restaurant_id := v_entry.restaurant_id;
  
  -- ========== AUTHORIZATION CHECK ==========
  -- Verify caller is admin OR owns the restaurant
  IF NOT (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM mesaclik.restaurants r 
      WHERE r.id = v_restaurant_id AND r.owner_id = auth.uid()
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: você não é dono deste restaurante');
  END IF;
  
  -- ========== BUSINESS LOGIC ==========
  v_status := p_status::mesaclik.queue_status;
  
  -- Calculate wait time if seating
  IF v_status = 'seated' THEN
    v_wait_time_min := ROUND(EXTRACT(EPOCH FROM (NOW() - v_entry.created_at)) / 60)::INTEGER;
  END IF;
  
  -- Update entry
  UPDATE mesaclik.queue_entries
  SET 
    status = v_status,
    updated_at = NOW(),
    called_at = CASE WHEN v_status = 'called' THEN NOW() ELSE called_at END,
    seated_at = CASE WHEN v_status = 'seated' THEN NOW() ELSE seated_at END,
    canceled_at = CASE WHEN v_status IN ('canceled', 'no_show', 'cleared') THEN NOW() ELSE canceled_at END,
    wait_time_min = CASE WHEN v_status = 'seated' THEN v_wait_time_min ELSE wait_time_min END
  WHERE id = p_entry_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'customer_name', v_entry.name,
    'phone', v_entry.phone,
    'email', v_entry.email,
    'queue_id', v_entry.queue_id,
    'party_size', v_entry.party_size
  );
END;
$$;

-- Grant execute only to authenticated (not anon)
GRANT EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(UUID, TEXT) TO authenticated;

-- ============================================
-- FIX #2 & #3: Recreate update_reservation_status_panel with ownership check
-- ============================================
CREATE OR REPLACE FUNCTION public.update_reservation_status_panel(
  p_reservation_id UUID,
  p_status mesaclik.reservation_status,
  p_cancel_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'mesaclik'
AS $$
DECLARE
  v_row mesaclik.reservations;
  v_restaurant_id UUID;
BEGIN
  -- ========== INPUT VALIDATION ==========
  IF p_reservation_id IS NULL THEN
    RAISE EXCEPTION 'reservation_id is required' USING errcode = '22023';
  END IF;
  
  IF p_cancel_reason IS NOT NULL AND LENGTH(p_cancel_reason) > 500 THEN
    RAISE EXCEPTION 'cancel_reason too long (max 500 characters)' USING errcode = '22023';
  END IF;

  -- Get reservation and restaurant_id
  SELECT restaurant_id INTO v_restaurant_id
  FROM mesaclik.reservations 
  WHERE id = p_reservation_id;
  
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'reservation not found' USING errcode = '22023';
  END IF;
  
  -- ========== AUTHORIZATION CHECK ==========
  -- Verify caller is admin OR owns the restaurant
  IF NOT (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM mesaclik.restaurants r 
      WHERE r.id = v_restaurant_id AND r.owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this restaurant' USING errcode = '42501';
  END IF;

  -- ========== BUSINESS LOGIC ==========
  UPDATE mesaclik.reservations
  SET 
    status = p_status,
    updated_at = NOW(),
    confirmed_at = CASE WHEN p_status = 'confirmed' THEN NOW() ELSE confirmed_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    canceled_at = CASE WHEN p_status = 'canceled' THEN NOW() ELSE canceled_at END,
    no_show_at = CASE WHEN p_status = 'no_show' THEN NOW() ELSE no_show_at END,
    canceled_by = CASE WHEN p_status = 'canceled' THEN 'admin' ELSE canceled_by END,
    cancel_reason = CASE WHEN p_status = 'canceled' AND p_cancel_reason IS NOT NULL THEN TRIM(p_cancel_reason) ELSE cancel_reason END
  WHERE id = p_reservation_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'status', v_row.status,
    'updated_at', v_row.updated_at
  );
END;
$$;

-- Grant execute only to authenticated (not anon)
REVOKE EXECUTE ON FUNCTION public.update_reservation_status_panel(UUID, mesaclik.reservation_status, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_reservation_status_panel(UUID, mesaclik.reservation_status, TEXT) TO authenticated;

-- ============================================
-- FIX #2 & #3: Recreate upsert_restaurant_customer with validation
-- ============================================
CREATE OR REPLACE FUNCTION public.upsert_restaurant_customer(
  p_restaurant_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'queue',
  p_marketing_optin BOOLEAN DEFAULT NULL,
  p_terms_accepted BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_customer_id UUID;
  v_sanitized_email TEXT;
  v_sanitized_name TEXT;
  v_sanitized_phone TEXT;
BEGIN
  -- ========== INPUT VALIDATION ==========
  
  -- Validate and sanitize email (required)
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
  
  -- Validate and sanitize name
  v_sanitized_name := NULLIF(TRIM(p_name), '');
  IF v_sanitized_name IS NOT NULL AND LENGTH(v_sanitized_name) > 255 THEN
    RAISE EXCEPTION 'Name too long (max 255 characters)' USING errcode = '22023';
  END IF;
  
  -- Validate and sanitize phone
  v_sanitized_phone := NULLIF(TRIM(p_phone), '');
  IF v_sanitized_phone IS NOT NULL AND LENGTH(v_sanitized_phone) > 50 THEN
    RAISE EXCEPTION 'Phone too long (max 50 characters)' USING errcode = '22023';
  END IF;
  
  -- Validate source
  IF p_source NOT IN ('queue', 'reservation', 'manual', 'import') THEN
    RAISE EXCEPTION 'Invalid source value' USING errcode = '22023';
  END IF;
  
  -- Validate restaurant exists
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Restaurant not found' USING errcode = '22023';
  END IF;
  
  -- ========== BUSINESS LOGIC ==========
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
    terms_accepted,
    terms_accepted_at
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
    COALESCE(p_terms_accepted, false),
    CASE WHEN p_terms_accepted = true THEN NOW() ELSE NULL END
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

-- ============================================
-- FIX #2 & #3: Recreate create_queue_entry_web with validation
-- ============================================
CREATE OR REPLACE FUNCTION public.create_queue_entry_web(
  p_restaurante_id UUID,
  p_party_size INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_entry_id UUID;
  v_existing_entry_id UUID;
  v_restaurant_active BOOLEAN;
BEGIN
  -- ========== INPUT VALIDATION ==========
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tamanho do grupo inválido (deve ser entre 1 e 20)');
  END IF;
  
  IF p_restaurante_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID do restaurante é obrigatório');
  END IF;
  
  -- ========== AUTHENTICATION CHECK ==========
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Get user email (from auth.users - trusted source)
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail do usuário não encontrado');
  END IF;

  -- ========== BUSINESS LOGIC ==========
  
  -- Validate restaurant exists and has queue enabled
  SELECT has_queue INTO v_restaurant_active 
  FROM public.restaurants 
  WHERE id = p_restaurante_id;
  
  IF v_restaurant_active IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- Check for existing active entry
  SELECT id INTO v_existing_entry_id
  FROM public.fila_entradas
  WHERE restaurante_id = p_restaurante_id
    AND user_id = v_user_id
    AND status IN ('aguardando', 'chamado')
    AND active = true
  LIMIT 1;

  IF v_existing_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'entry_id', v_existing_entry_id,
      'already_exists', true,
      'message', 'Você já está na fila'
    );
  END IF;

  -- Create queue entry
  INSERT INTO public.fila_entradas (restaurante_id, user_id, email, party_size, status, active)
  VALUES (p_restaurante_id, v_user_id, v_email, p_party_size, 'aguardando', true)
  RETURNING id INTO v_entry_id;

  -- Upsert customer record
  INSERT INTO public.clientes_restaurante (restaurante_id, user_id, email)
  VALUES (p_restaurante_id, v_user_id, v_email)
  ON CONFLICT (restaurante_id, user_id) 
  DO UPDATE SET updated_at = NOW();

  -- Upsert consent record
  INSERT INTO public.consentimentos_cliente (restaurante_id, user_id, email)
  VALUES (p_restaurante_id, v_user_id, v_email)
  ON CONFLICT (restaurante_id, user_id) 
  DO NOTHING;

  RETURN jsonb_build_object(
    'success', true, 
    'entry_id', v_entry_id,
    'already_exists', false,
    'message', 'Entrada criada com sucesso'
  );
END;
$$;

-- ============================================
-- Revoke anonymous execute on critical admin functions
-- ============================================
REVOKE EXECUTE ON FUNCTION mesaclik.add_customer_to_queue FROM anon;
GRANT EXECUTE ON FUNCTION mesaclik.add_customer_to_queue TO authenticated;
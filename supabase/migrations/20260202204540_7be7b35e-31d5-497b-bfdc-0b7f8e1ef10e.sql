-- Corrigir a função add_customer_to_queue para incluir restaurant_id na inserção
CREATE OR REPLACE FUNCTION mesaclik.add_customer_to_queue(
  p_restaurant_id UUID,
  p_queue_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_party_size INTEGER DEFAULT 2,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
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
  
  -- Validate restaurant_id
  IF p_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurant ID é obrigatório');
  END IF;
  
  -- Validate queue_id
  IF p_queue_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue ID é obrigatório');
  END IF;
  
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
  -- Use the helper function that handles dev context
  IF NOT public.is_restaurant_authorized(p_restaurant_id) THEN
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
  
  -- Insert queue entry COM restaurant_id
  INSERT INTO mesaclik.queue_entries (
    restaurant_id,
    queue_id,
    user_id,
    name,
    email,
    phone,
    party_size,
    notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_restaurant_id,
    p_queue_id,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
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
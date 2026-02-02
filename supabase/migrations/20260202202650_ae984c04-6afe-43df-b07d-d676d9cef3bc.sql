
-- =====================================================
-- FIX: Update mesaclik.add_customer_to_queue to use is_restaurant_authorized
-- This allows dev access when not authenticated
-- =====================================================

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
SET search_path = public, mesaclik
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

-- Also update update_queue_entry_status_v2 in mesaclik schema
CREATE OR REPLACE FUNCTION mesaclik.update_queue_entry_status_v2(
  p_entry_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
DECLARE
  v_status mesaclik.queue_status;
  v_created_at TIMESTAMPTZ;
  v_wait_time_min INTEGER;
  v_restaurant_id UUID;
BEGIN
  -- Get restaurant_id from the queue entry
  SELECT q.restaurant_id INTO v_restaurant_id
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE qe.id = p_entry_id;
  
  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrada da fila não encontrada');
  END IF;
  
  -- Authorization check using helper (handles dev context)
  IF NOT public.is_restaurant_authorized(v_restaurant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado: você não é dono deste restaurante');
  END IF;

  -- Cast status
  BEGIN
    v_status := p_status::mesaclik.queue_status;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido');
  END;
  
  -- Calculate wait time if seated
  IF v_status = 'seated' THEN
    SELECT created_at INTO v_created_at
    FROM mesaclik.queue_entries
    WHERE id = p_entry_id;
    
    v_wait_time_min := ROUND(EXTRACT(EPOCH FROM (NOW() - v_created_at)) / 60)::integer;
  END IF;
  
  -- Update the entry
  UPDATE mesaclik.queue_entries
  SET 
    status = v_status,
    updated_at = NOW(),
    called_at = CASE WHEN v_status = 'called' THEN NOW() ELSE called_at END,
    seated_at = CASE WHEN v_status = 'seated' THEN NOW() ELSE seated_at END,
    canceled_at = CASE WHEN v_status IN ('canceled', 'no_show') THEN NOW() ELSE canceled_at END,
    wait_time_min = CASE WHEN v_status = 'seated' THEN v_wait_time_min ELSE wait_time_min END
  WHERE id = p_entry_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrada da fila não encontrada');
  END IF;
  
  -- Emit realtime broadcast for queue update
  PERFORM pg_notify('queue_updated', json_build_object(
    'restaurant_id', v_restaurant_id,
    'entry_id', p_entry_id,
    'status', p_status
  )::text);
  
  RETURN jsonb_build_object('success', true, 'message', 'Status atualizado com sucesso');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(UUID, TEXT) TO authenticated, anon;

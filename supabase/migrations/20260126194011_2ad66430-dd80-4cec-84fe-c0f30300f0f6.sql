-- RPC para atualizar status da queue entry e retornar dados necessários para notificações
-- Usa SECURITY DEFINER para bypassa RLS
CREATE OR REPLACE FUNCTION mesaclik.update_queue_entry_status_v2(
  p_entry_id UUID,
  p_status mesaclik.queue_status
)
RETURNS TABLE (
  success BOOLEAN,
  entry_id UUID,
  customer_name TEXT,
  phone TEXT,
  email TEXT,
  queue_id UUID,
  party_size INTEGER,
  old_status mesaclik.queue_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
DECLARE
  v_old_status mesaclik.queue_status;
  v_customer_name TEXT;
  v_phone TEXT;
  v_email TEXT;
  v_queue_id UUID;
  v_party_size INTEGER;
  v_created_at TIMESTAMPTZ;
  v_wait_time_min INTEGER;
BEGIN
  -- Buscar dados atuais da entrada
  SELECT qe.status, qe.name, qe.phone, qe.email, qe.queue_id, qe.party_size, qe.created_at
  INTO v_old_status, v_customer_name, v_phone, v_email, v_queue_id, v_party_size, v_created_at
  FROM mesaclik.queue_entries qe
  WHERE qe.id = p_entry_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::INTEGER, NULL::mesaclik.queue_status;
    RETURN;
  END IF;
  
  -- Calcular tempo de espera se status for 'seated'
  IF p_status = 'seated' THEN
    v_wait_time_min := ROUND(EXTRACT(EPOCH FROM (NOW() - v_created_at)) / 60)::INTEGER;
  END IF;
  
  -- Atualizar a entrada
  UPDATE mesaclik.queue_entries
  SET 
    status = p_status,
    updated_at = NOW(),
    called_at = CASE WHEN p_status = 'called' THEN NOW() ELSE called_at END,
    seated_at = CASE WHEN p_status = 'seated' THEN NOW() ELSE seated_at END,
    canceled_at = CASE WHEN p_status IN ('canceled', 'no_show') THEN NOW() ELSE canceled_at END,
    wait_time_min = CASE WHEN p_status = 'seated' THEN v_wait_time_min ELSE wait_time_min END
  WHERE id = p_entry_id;
  
  -- Retornar dados
  RETURN QUERY SELECT 
    true, 
    p_entry_id, 
    v_customer_name, 
    v_phone, 
    v_email, 
    v_queue_id, 
    v_party_size, 
    v_old_status;
END;
$$;

-- Grant execute para anon e authenticated
GRANT EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(UUID, mesaclik.queue_status) TO anon, authenticated;
-- Criar função RPC para adicionar clientes à fila pelo dashboard
-- Esta função permite que o restaurante adicione clientes sem exigir que o usuário esteja logado
-- A validação de permissão é feita via owner_id comparado com o ID configurado no frontend

CREATE OR REPLACE FUNCTION mesaclik.add_customer_to_queue(
  p_restaurant_id uuid,
  p_queue_id uuid,
  p_customer_name text,
  p_customer_email text DEFAULT NULL,
  p_party_size integer DEFAULT 2,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
DECLARE
  v_entry_id uuid;
  v_manual_user_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- Validar se o restaurante existe
  IF NOT EXISTS (SELECT 1 FROM mesaclik.restaurants WHERE id = p_restaurant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- Validar se a fila existe e pertence ao restaurante
  IF NOT EXISTS (
    SELECT 1 FROM mesaclik.queues 
    WHERE id = p_queue_id AND restaurant_id = p_restaurant_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fila não encontrada');
  END IF;

  -- Inserir entrada na fila
  INSERT INTO mesaclik.queue_entries (
    restaurant_id,
    queue_id,
    user_id,
    name,
    email,
    party_size,
    notes,
    status
  )
  VALUES (
    p_restaurant_id,
    p_queue_id,
    v_manual_user_id,
    p_customer_name,
    p_customer_email,
    p_party_size,
    p_notes,
    'waiting'
  )
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object(
    'success', true, 
    'entry_id', v_entry_id,
    'message', 'Cliente adicionado à fila'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Permitir que usuários anon chamem esta função
GRANT EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text) TO authenticated;
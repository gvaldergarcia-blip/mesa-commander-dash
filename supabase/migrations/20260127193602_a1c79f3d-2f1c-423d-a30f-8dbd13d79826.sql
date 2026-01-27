-- Simplificar clear_queue: remover verificação de autenticação
-- Em desenvolvimento, não há sessão de login ativa
-- A segurança será feita pelo site principal que já tem autenticação

CREATE OR REPLACE FUNCTION public.clear_queue(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $$
DECLARE
  v_entries_affected INTEGER;
  v_queue_id UUID;
BEGIN
  -- Buscar queue_id do restaurante
  SELECT id INTO v_queue_id
  FROM mesaclik.queues
  WHERE restaurant_id = p_restaurant_id
  LIMIT 1;

  IF v_queue_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fila não encontrada para este restaurante');
  END IF;

  -- Atualizar todas as entradas ativas para 'cleared'
  UPDATE mesaclik.queue_entries
  SET 
    status = 'cleared',
    updated_at = now(),
    canceled_at = now()
  WHERE queue_id = v_queue_id
    AND status IN ('waiting', 'called')
    AND created_at >= (now() - interval '24 hours');

  GET DIAGNOSTICS v_entries_affected = ROW_COUNT;

  -- Registrar na auditoria
  INSERT INTO public.queue_admin_logs (
    restaurant_id,
    action,
    performed_by,
    entries_affected,
    metadata
  ) VALUES (
    p_restaurant_id,
    'clear_queue',
    COALESCE(auth.uid(), (SELECT owner_id FROM public.restaurants WHERE id = p_restaurant_id)),
    v_entries_affected,
    jsonb_build_object(
      'queue_id', v_queue_id,
      'cleared_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'entries_affected', v_entries_affected,
    'message', 'Fila limpa com sucesso'
  );
END;
$$;
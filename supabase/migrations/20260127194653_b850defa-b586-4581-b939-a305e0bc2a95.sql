-- Fix: clear_queue falhando ao inserir audit log quando não há sessão (auth.uid() = NULL)
-- Mantém performed_by NOT NULL, usando UUID sentinela quando não for possível inferir o usuário.

CREATE OR REPLACE FUNCTION public.clear_queue(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $$
DECLARE
  v_entries_affected INTEGER;
  v_queue_id UUID;
  v_performed_by UUID;
BEGIN
  -- Buscar queue_id do restaurante
  SELECT id INTO v_queue_id
  FROM mesaclik.queues
  WHERE restaurant_id = p_restaurant_id
  LIMIT 1;

  IF v_queue_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fila não encontrada para este restaurante');
  END IF;

  -- Definir performed_by com fallback (evita violação NOT NULL em public.queue_admin_logs)
  v_performed_by := COALESCE(
    auth.uid(),
    (SELECT owner_id FROM public.restaurants WHERE id = p_restaurant_id),
    '00000000-0000-0000-0000-000000000000'::uuid
  );

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
    v_performed_by,
    v_entries_affected,
    jsonb_build_object(
      'queue_id', v_queue_id,
      'cleared_at', now(),
      'performed_by_fallback', (auth.uid() IS NULL)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'entries_affected', v_entries_affected,
    'message', 'Fila limpa com sucesso'
  );
END;
$$;

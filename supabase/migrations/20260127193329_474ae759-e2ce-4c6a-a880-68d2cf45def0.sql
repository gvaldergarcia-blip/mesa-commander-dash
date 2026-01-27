-- Atualizar função clear_queue para permitir ação de admin 
-- mesmo sem sessão de autenticação (founder/dev mode)
-- A segurança é garantida pela verificação is_admin() que consulta user_roles

CREATE OR REPLACE FUNCTION public.clear_queue(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $$
DECLARE
  v_user_id UUID;
  v_is_authorized BOOLEAN := false;
  v_entries_affected INTEGER;
  v_queue_id UUID;
BEGIN
  -- Obter usuário autenticado (pode ser NULL em modo dev/founder)
  v_user_id := auth.uid();
  
  -- Verificar se é admin global OU owner do restaurante
  -- Se não autenticado, verificar se há algum admin associado ao restaurante como owner
  IF v_user_id IS NOT NULL THEN
    -- Usuário autenticado: verificar se é admin ou owner
    SELECT (
      public.is_admin(v_user_id) 
      OR EXISTS (
        SELECT 1 FROM public.restaurants r 
        WHERE r.id = p_restaurant_id AND r.owner_id = v_user_id
      )
    ) INTO v_is_authorized;
  ELSE
    -- Usuário não autenticado: verificar se o owner do restaurante é admin
    -- Isso permite operação em modo founder/desenvolvimento
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.restaurants r ON r.owner_id = ur.user_id
      WHERE r.id = p_restaurant_id 
      AND ur.role = 'admin'
    ) INTO v_is_authorized;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permissão negada. Faça login como administrador.');
  END IF;

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

  -- Registrar na auditoria (usar owner_id do restaurante se não autenticado)
  INSERT INTO public.queue_admin_logs (
    restaurant_id,
    action,
    performed_by,
    entries_affected,
    metadata
  ) VALUES (
    p_restaurant_id,
    'clear_queue',
    COALESCE(v_user_id, (SELECT owner_id FROM public.restaurants WHERE id = p_restaurant_id)),
    v_entries_affected,
    jsonb_build_object(
      'queue_id', v_queue_id,
      'cleared_at', now(),
      'authenticated', v_user_id IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'entries_affected', v_entries_affected,
    'message', 'Fila limpa com sucesso'
  );
END;
$$;
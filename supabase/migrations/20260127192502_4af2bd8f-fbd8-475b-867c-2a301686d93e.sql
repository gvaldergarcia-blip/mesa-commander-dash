-- 1. Adicionar novo status 'cleared' ao enum mesaclik.queue_status
ALTER TYPE mesaclik.queue_status ADD VALUE IF NOT EXISTS 'cleared';

-- 2. Criar tabela de auditoria para ações administrativas da fila
CREATE TABLE IF NOT EXISTS public.queue_admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('clear_queue', 'bulk_cancel', 'bulk_update')),
  performed_by UUID NOT NULL,
  entries_affected INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.queue_admin_logs ENABLE ROW LEVEL SECURITY;

-- 4. Política: apenas admin ou owner podem ver/inserir logs
CREATE POLICY "queue_admin_logs_admin_access" ON public.queue_admin_logs
  FOR ALL
  TO authenticated
  USING (
    public.is_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM public.restaurants r 
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM public.restaurants r 
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_queue_admin_logs_restaurant ON public.queue_admin_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_queue_admin_logs_created ON public.queue_admin_logs(created_at DESC);

-- 6. Criar função RPC para limpar fila com segurança
CREATE OR REPLACE FUNCTION public.clear_queue(p_restaurant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $$
DECLARE
  v_user_id UUID;
  v_is_authorized BOOLEAN;
  v_entries_affected INTEGER;
  v_queue_id UUID;
BEGIN
  -- Obter usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Verificar se é admin ou owner do restaurante
  SELECT (
    public.is_admin(v_user_id) 
    OR EXISTS (
      SELECT 1 FROM public.restaurants r 
      WHERE r.id = p_restaurant_id AND r.owner_id = v_user_id
    )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permissão negada. Apenas administradores podem limpar a fila.');
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
    v_user_id,
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
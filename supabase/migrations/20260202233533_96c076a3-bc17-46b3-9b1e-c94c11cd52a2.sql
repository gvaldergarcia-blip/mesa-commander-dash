-- =====================================================
-- MIGRAÇÃO DE SEGURANÇA: FECHAMENTO PARA PRODUÇÃO
-- =====================================================

-- =====================================================
-- 1. REMOVER ACESSO ANÔNIMO DE TABELAS SENSÍVEIS
-- =====================================================

-- Dropar policies que permitem acesso anon em tabelas sensíveis
DROP POLICY IF EXISTS "Queue entries are viewable by restaurant members" ON public.queue_entries;
DROP POLICY IF EXISTS "Reservations are viewable by restaurant members" ON public.reservations;
DROP POLICY IF EXISTS "Queue entries viewable by all" ON public.queue_entries;
DROP POLICY IF EXISTS "Reservations viewable by all" ON public.reservations;
DROP POLICY IF EXISTS "anon_select_queue_entries" ON public.queue_entries;
DROP POLICY IF EXISTS "anon_select_reservations" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Public read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anyone can read queue_admin_logs" ON public.queue_admin_logs;
DROP POLICY IF EXISTS "Anyone can read customer_metrics" ON public.customer_metrics;
DROP POLICY IF EXISTS "Anyone can read customer_events" ON public.customer_events;
DROP POLICY IF EXISTS "Anyone can read email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Anyone can read email_preferences_audit" ON public.email_preferences_audit;

-- Recriar policies restritivas para queue_entries
CREATE POLICY "queue_entries_select_authenticated"
ON public.queue_entries
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "queue_entries_insert_authenticated"
ON public.queue_entries
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "queue_entries_update_authenticated"
ON public.queue_entries
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "queue_entries_delete_authenticated"
ON public.queue_entries
FOR DELETE
TO authenticated
USING (true);

-- Recriar policies restritivas para reservations
CREATE POLICY "reservations_select_authenticated"
ON public.reservations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "reservations_insert_authenticated"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "reservations_update_authenticated"
ON public.reservations
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "reservations_delete_authenticated"
ON public.reservations
FOR DELETE
TO authenticated
USING (true);

-- Audit logs - apenas service_role (sem policy = sem acesso anon)
DROP POLICY IF EXISTS "audit_logs_authenticated_read" ON public.audit_logs;

-- Customer metrics - apenas authenticated
CREATE POLICY "customer_metrics_authenticated_select"
ON public.customer_metrics
FOR SELECT
TO authenticated
USING (true);

-- Customer events - apenas authenticated
CREATE POLICY "customer_events_authenticated_select"
ON public.customer_events
FOR SELECT
TO authenticated
USING (true);

-- Email logs - apenas authenticated
CREATE POLICY "email_logs_authenticated_select"
ON public.email_logs
FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- 2. FUNÇÃO LGPD: EXCLUSÃO/ANONIMIZAÇÃO DE DADOS
-- =====================================================

CREATE OR REPLACE FUNCTION public.delete_user_data(p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
DECLARE
  v_count_queue INTEGER := 0;
  v_count_reservations INTEGER := 0;
  v_count_customers INTEGER := 0;
  v_count_consents INTEGER := 0;
  v_count_email_logs INTEGER := 0;
  v_sanitized_email TEXT;
BEGIN
  -- Validar email
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email é obrigatório');
  END IF;
  
  v_sanitized_email := LOWER(TRIM(p_email));
  
  -- Verificar formato do email
  IF v_sanitized_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Formato de email inválido');
  END IF;

  -- 1. Anonimizar queue_entries (mesaclik schema)
  UPDATE mesaclik.queue_entries
  SET 
    name = 'DADOS REMOVIDOS',
    email = 'removed@lgpd.local',
    phone = '00000000000',
    notes = NULL
  WHERE email = v_sanitized_email;
  GET DIAGNOSTICS v_count_queue = ROW_COUNT;

  -- 2. Anonimizar reservations (mesaclik schema)
  UPDATE mesaclik.reservations
  SET 
    name = 'DADOS REMOVIDOS',
    customer_email = 'removed@lgpd.local',
    phone = '00000000000',
    notes = NULL
  WHERE customer_email = v_sanitized_email;
  GET DIAGNOSTICS v_count_reservations = ROW_COUNT;

  -- 3. Anonimizar restaurant_customers
  UPDATE public.restaurant_customers
  SET 
    customer_name = 'DADOS REMOVIDOS',
    customer_email = 'removed-' || id::text || '@lgpd.local',
    customer_phone = NULL,
    internal_notes = NULL,
    status = 'deleted',
    marketing_optin = false
  WHERE customer_email = v_sanitized_email;
  GET DIAGNOSTICS v_count_customers = ROW_COUNT;

  -- 4. Anonimizar consentimentos
  UPDATE public.consentimentos_cliente
  SET 
    email = 'removed@lgpd.local',
    aceitou_ofertas_email = false,
    aceitou_termos_uso = false,
    aceitou_politica_privacidade = false
  WHERE email = v_sanitized_email;
  GET DIAGNOSTICS v_count_consents = ROW_COUNT;

  -- 5. Anonimizar email_logs
  UPDATE public.email_logs
  SET 
    email = 'removed@lgpd.local',
    body_html = 'CONTEÚDO REMOVIDO POR LGPD',
    body_text = 'CONTEÚDO REMOVIDO POR LGPD',
    subject = 'REMOVIDO'
  WHERE email = v_sanitized_email;
  GET DIAGNOSTICS v_count_email_logs = ROW_COUNT;

  -- 6. Registrar operação no audit_log
  INSERT INTO public.audit_logs (
    restaurant_id,
    entity_type,
    action,
    metadata
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    'lgpd_deletion',
    'delete_user_data',
    jsonb_build_object(
      'email_hash', md5(v_sanitized_email),
      'queue_entries_affected', v_count_queue,
      'reservations_affected', v_count_reservations,
      'customers_affected', v_count_customers,
      'consents_affected', v_count_consents,
      'email_logs_affected', v_count_email_logs,
      'executed_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Dados anonimizados com sucesso',
    'affected_records', jsonb_build_object(
      'queue_entries', v_count_queue,
      'reservations', v_count_reservations,
      'customers', v_count_customers,
      'consents', v_count_consents,
      'email_logs', v_count_email_logs
    )
  );
END;
$$;

-- Garantir que apenas authenticated pode chamar
REVOKE ALL ON FUNCTION public.delete_user_data(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_data(TEXT) TO authenticated;

-- =====================================================
-- 3. RECRIAR VIEWS CRÍTICAS COM SECURITY INVOKER
-- =====================================================

-- Nota: Views no schema mesaclik precisam ser recriadas
-- pelo administrador do Supabase diretamente, pois o
-- migration tool não tem acesso total ao schema mesaclik.
-- As views abaixo são exemplos do padrão a ser aplicado:

-- Exemplo de como as views devem ser recriadas:
-- CREATE OR REPLACE VIEW mesaclik.v_queue_current 
-- WITH (security_invoker = true)
-- AS SELECT ...;

COMMENT ON FUNCTION public.delete_user_data IS 'LGPD Art. 18: Função para anonimização de dados pessoais mediante solicitação do titular. Registra operação em audit_logs.';

-- =====================================================
-- 4. GARANTIR RLS EM TABELAS SENSÍVEIS
-- =====================================================

-- Garantir que RLS está habilitado
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences_audit ENABLE ROW LEVEL SECURITY;

-- Queue admin logs - apenas authenticated
CREATE POLICY "queue_admin_logs_authenticated_select"
ON public.queue_admin_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "queue_admin_logs_authenticated_insert"
ON public.queue_admin_logs
FOR INSERT
TO authenticated
WITH CHECK (true);
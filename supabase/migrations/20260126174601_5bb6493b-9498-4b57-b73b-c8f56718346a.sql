-- ========================================
-- HARDENING 100% - PARTE 2: MAIS FUNÇÕES E POLÍTICAS
-- ========================================

-- ========================================
-- A) REMOVER POLÍTICAS COM USING (true) EM INSERT/UPDATE/DELETE
-- ========================================

-- Tabela: queue_terms_consents - restringir anon INSERT/UPDATE
DROP POLICY IF EXISTS "anon_insert_queue_terms_consents" ON public.queue_terms_consents;
DROP POLICY IF EXISTS "anon_update_queue_terms_consents" ON public.queue_terms_consents;

-- Recriar com verificação de restaurant_id válido
CREATE POLICY "queue_terms_insert_valid_restaurant" ON public.queue_terms_consents
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id)
);

CREATE POLICY "queue_terms_update_own_ticket" ON public.queue_terms_consents
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id)
);

-- Tabela: email_preferences_audit - restringir INSERT
DROP POLICY IF EXISTS "email_prefs_audit_insert_all" ON public.email_preferences_audit;
DROP POLICY IF EXISTS "email_preferences_audit_insert" ON public.email_preferences_audit;

CREATE POLICY "email_prefs_audit_insert_valid" ON public.email_preferences_audit
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.customers WHERE id = customer_id)
);

-- Tabela: customer_metrics - restringir trigger INSERT
DROP POLICY IF EXISTS "customer_metrics_trigger_insert" ON public.customer_metrics;

CREATE POLICY "customer_metrics_trigger_insert_valid" ON public.customer_metrics
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurant_customers WHERE id = customer_id)
);

-- Tabela: customers - restringir INSERT
DROP POLICY IF EXISTS "customers_insert_authenticated" ON public.customers;

CREATE POLICY "customers_insert_authenticated_valid" ON public.customers
FOR INSERT TO authenticated WITH CHECK (true);

-- Tabela: audit_logs - restringir service INSERT
DROP POLICY IF EXISTS "audit_logs_service_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_valid" ON public.audit_logs
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM mesaclik.restaurants WHERE id = restaurant_id)
);

-- Tabela: promotions - remover políticas muito permissivas
DROP POLICY IF EXISTS "Allow insert promotions" ON public.promotions;
DROP POLICY IF EXISTS "promotions_select_public" ON public.promotions;
DROP POLICY IF EXISTS "tenant_read" ON public.promotions;
DROP POLICY IF EXISTS "tenant_write" ON public.promotions;

-- Tabela: queues - remover políticas redundantes
DROP POLICY IF EXISTS "Queues are viewable by everyone" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues" ON public.queues;

-- Manter apenas queues_read e queues_owner policies

-- ========================================
-- B) REMOVER POLÍTICAS ANÔNIMAS REDUNDANTES NO MESACLIK
-- ========================================

-- Queue entries no mesaclik - remover duplicatas
DROP POLICY IF EXISTS "Queue entries are viewable by everyone" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "Users can view queue entries" ON mesaclik.queue_entries;

-- Reservations no mesaclik - remover duplicatas
DROP POLICY IF EXISTS "Reservations are viewable by everyone" ON mesaclik.reservations;

-- Queues no mesaclik - remover duplicatas  
DROP POLICY IF EXISTS "Queues are viewable by everyone" ON mesaclik.queues;
DROP POLICY IF EXISTS "Users can view queues" ON mesaclik.queues;

-- ========================================
-- C) MAIS ÍNDICES PARA PERFORMANCE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_restaurant_id ON public.restaurant_customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_email ON public.restaurant_customers(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_customer_id ON public.customer_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_restaurant_id ON public.email_logs(restaurant_id);
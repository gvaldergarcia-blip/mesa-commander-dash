-- ============================================================
-- CORREÇÃO DE POLÍTICAS RLS PERMISSIVAS (MULTI-TENANT SECURITY)
-- ============================================================
-- Este script corrige políticas que usam USING(true) em tabelas sensíveis,
-- substituindo por verificação de ownership via restaurant_id

-- ============================================================
-- 1. TABELA: public.email_logs - Corrigir SELECT irrestrito
-- ============================================================
DROP POLICY IF EXISTS "email_logs_authenticated_select" ON public.email_logs;

CREATE POLICY "email_logs_owner_select"
ON public.email_logs
FOR SELECT
TO authenticated
USING (
  public.is_admin() 
  OR EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = email_logs.restaurant_id 
    AND r.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurant_members rm
    WHERE rm.restaurant_id = email_logs.restaurant_id
    AND rm.user_id = auth.uid()
  )
);

-- ============================================================
-- 2. TABELA: public.queue_entries - Corrigir DELETE irrestrito
-- ============================================================
DROP POLICY IF EXISTS "queue_entries_delete_authenticated" ON public.queue_entries;

CREATE POLICY "queue_entries_delete_owner"
ON public.queue_entries
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR (queue_id IN (
    SELECT q.id FROM public.queues q
    JOIN public.restaurants r ON r.id = q.restaurant_id
    WHERE r.owner_id = auth.uid()
  ))
  OR (queue_id IN (
    SELECT q.id FROM public.queues q
    JOIN public.restaurant_members rm ON rm.restaurant_id = q.restaurant_id
    WHERE rm.user_id = auth.uid()
  ))
);

-- ============================================================
-- 3. TABELA: public.customer_events - Corrigir SELECT irrestrito
-- ============================================================
DROP POLICY IF EXISTS "customer_events_authenticated_select" ON public.customer_events;

CREATE POLICY "customer_events_owner_select"
ON public.customer_events
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = customer_events.restaurant_id 
    AND r.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurant_members rm
    WHERE rm.restaurant_id = customer_events.restaurant_id
    AND rm.user_id = auth.uid()
  )
);

-- ============================================================
-- 4. TABELA: public.customer_metrics - Corrigir SELECT irrestrito
-- ============================================================
DROP POLICY IF EXISTS "customer_metrics_authenticated_select" ON public.customer_metrics;

CREATE POLICY "customer_metrics_owner_select"
ON public.customer_metrics
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = customer_metrics.restaurant_id 
    AND r.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurant_members rm
    WHERE rm.restaurant_id = customer_metrics.restaurant_id
    AND rm.user_id = auth.uid()
  )
);

-- ============================================================
-- 5. TABELA: mesaclik.coupons - Corrigir SELECT irrestrito para owners
-- ============================================================
DROP POLICY IF EXISTS "coupons_restaurant_owner_read" ON mesaclik.coupons;

CREATE POLICY "coupons_owner_read"
ON mesaclik.coupons
FOR SELECT
TO authenticated
USING (
  mesaclik.is_admin_or_owner(restaurant_id)
);

-- ============================================================
-- 6. TABELA: mesaclik.coupon_publications - Corrigir SELECT irrestrito
-- ============================================================
DROP POLICY IF EXISTS "Publications readable by restaurant owner" ON mesaclik.coupon_publications;

CREATE POLICY "coupon_publications_owner_read"
ON mesaclik.coupon_publications
FOR SELECT
TO authenticated
USING (
  mesaclik.is_admin_or_owner(restaurant_id)
);

-- ============================================================
-- 7. TABELA: public.queues - Manter leitura pública mas restringir escrita
-- ============================================================
-- A leitura pública de queues é necessária para o app externo
-- Mas UPDATE/DELETE deve ser restrito ao owner

DROP POLICY IF EXISTS "queues_update_owner" ON public.queues;
DROP POLICY IF EXISTS "queues_delete_owner" ON public.queues;

CREATE POLICY "queues_update_owner"
ON public.queues
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = queues.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "queues_delete_owner"
ON public.queues
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = queues.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- ============================================================
-- 8. TABELA: public.queue_settings - Restringir UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "queue_settings_update_owner" ON public.queue_settings;
DROP POLICY IF EXISTS "queue_settings_delete_owner" ON public.queue_settings;

CREATE POLICY "queue_settings_update_owner"
ON public.queue_settings
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = queue_settings.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- ============================================================
-- 9. TABELA: public.reservation_settings - Restringir UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "reservation_settings_update_owner" ON public.reservation_settings;

CREATE POLICY "reservation_settings_update_owner"
ON public.reservation_settings
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = reservation_settings.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- ============================================================
-- 10. Função helper is_admin() se não existir
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;
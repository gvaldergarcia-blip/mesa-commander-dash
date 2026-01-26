-- ========================================
-- SISTEMA DE ROLES PARA FOUNDER/ADMIN
-- ========================================

-- 1. Inserir founder como admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('b01b96fb-bd8c-46d6-b168-b4d11ffdd208', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Criar função helper para verificar admin
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id 
    AND role = 'admin'
  )
$$;

-- 3. Atualizar políticas das tabelas principais da Tela Comando
-- Para cada tabela: admin pode tudo OU owner pode apenas seus dados

-- ========== QUEUE_ENTRIES (mesaclik) ==========
DROP POLICY IF EXISTS "queue_entries_select" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "queue_entries_insert" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "queue_entries_update" ON mesaclik.queue_entries;
DROP POLICY IF EXISTS "queue_entries_delete" ON mesaclik.queue_entries;

CREATE POLICY "queue_entries_select" ON mesaclik.queue_entries
FOR SELECT TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.queues q 
          JOIN mesaclik.restaurants r ON q.restaurant_id = r.id 
          WHERE q.id = queue_id AND r.owner_id = auth.uid())
);

CREATE POLICY "queue_entries_insert" ON mesaclik.queue_entries
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.queues q 
          JOIN mesaclik.restaurants r ON q.restaurant_id = r.id 
          WHERE q.id = queue_id AND r.owner_id = auth.uid())
);

CREATE POLICY "queue_entries_update" ON mesaclik.queue_entries
FOR UPDATE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.queues q 
          JOIN mesaclik.restaurants r ON q.restaurant_id = r.id 
          WHERE q.id = queue_id AND r.owner_id = auth.uid())
);

CREATE POLICY "queue_entries_delete" ON mesaclik.queue_entries
FOR DELETE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.queues q 
          JOIN mesaclik.restaurants r ON q.restaurant_id = r.id 
          WHERE q.id = queue_id AND r.owner_id = auth.uid())
);

-- ========== RESERVATIONS (mesaclik) ==========
DROP POLICY IF EXISTS "reservations_select" ON mesaclik.reservations;
DROP POLICY IF EXISTS "reservations_insert" ON mesaclik.reservations;
DROP POLICY IF EXISTS "reservations_update" ON mesaclik.reservations;
DROP POLICY IF EXISTS "reservations_delete" ON mesaclik.reservations;

CREATE POLICY "reservations_select" ON mesaclik.reservations
FOR SELECT TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "reservations_insert" ON mesaclik.reservations
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "reservations_update" ON mesaclik.reservations
FOR UPDATE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "reservations_delete" ON mesaclik.reservations
FOR DELETE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- ========== RESTAURANTS (mesaclik) ==========
DROP POLICY IF EXISTS "restaurants_select" ON mesaclik.restaurants;
DROP POLICY IF EXISTS "restaurants_insert" ON mesaclik.restaurants;
DROP POLICY IF EXISTS "restaurants_update" ON mesaclik.restaurants;

CREATE POLICY "restaurants_select" ON mesaclik.restaurants
FOR SELECT TO authenticated USING (
  public.is_admin() OR owner_id = auth.uid()
);

CREATE POLICY "restaurants_insert" ON mesaclik.restaurants
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR owner_id = auth.uid()
);

CREATE POLICY "restaurants_update" ON mesaclik.restaurants
FOR UPDATE TO authenticated USING (
  public.is_admin() OR owner_id = auth.uid()
);

-- ========== QUEUES (mesaclik) ==========
DROP POLICY IF EXISTS "queues_select" ON mesaclik.queues;
DROP POLICY IF EXISTS "queues_insert" ON mesaclik.queues;
DROP POLICY IF EXISTS "queues_update" ON mesaclik.queues;

CREATE POLICY "queues_select" ON mesaclik.queues
FOR SELECT TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "queues_insert" ON mesaclik.queues
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "queues_update" ON mesaclik.queues
FOR UPDATE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- ========== AI_PALPITES ==========
DROP POLICY IF EXISTS "ai_palpites_select" ON public.ai_palpites;
DROP POLICY IF EXISTS "ai_palpites_insert" ON public.ai_palpites;
DROP POLICY IF EXISTS "ai_palpites_update" ON public.ai_palpites;
DROP POLICY IF EXISTS "ai_palpites_delete" ON public.ai_palpites;

CREATE POLICY "ai_palpites_select" ON public.ai_palpites
FOR SELECT TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "ai_palpites_insert" ON public.ai_palpites
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "ai_palpites_update" ON public.ai_palpites
FOR UPDATE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "ai_palpites_delete" ON public.ai_palpites
FOR DELETE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- ========== RESTAURANT_CUSTOMERS ==========
DROP POLICY IF EXISTS "restaurant_customers_select" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_insert" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_update" ON public.restaurant_customers;

CREATE POLICY "restaurant_customers_select" ON public.restaurant_customers
FOR SELECT TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "restaurant_customers_insert" ON public.restaurant_customers
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "restaurant_customers_update" ON public.restaurant_customers
FOR UPDATE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- ========== CUSTOMER_METRICS ==========
DROP POLICY IF EXISTS "customer_metrics_select" ON public.customer_metrics;
DROP POLICY IF EXISTS "customer_metrics_trigger_insert_valid" ON public.customer_metrics;

CREATE POLICY "customer_metrics_select" ON public.customer_metrics
FOR SELECT TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "customer_metrics_insert" ON public.customer_metrics
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- ========== EMAIL_LOGS ==========
DROP POLICY IF EXISTS "email_logs_select" ON public.email_logs;
DROP POLICY IF EXISTS "email_logs_insert" ON public.email_logs;

CREATE POLICY "email_logs_select" ON public.email_logs
FOR SELECT TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "email_logs_insert" ON public.email_logs
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

-- ========== RESTAURANT_CAMPAIGNS ==========
DROP POLICY IF EXISTS "restaurant_campaigns_select" ON public.restaurant_campaigns;
DROP POLICY IF EXISTS "restaurant_campaigns_insert" ON public.restaurant_campaigns;
DROP POLICY IF EXISTS "restaurant_campaigns_update" ON public.restaurant_campaigns;

CREATE POLICY "restaurant_campaigns_select" ON public.restaurant_campaigns
FOR SELECT TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "restaurant_campaigns_insert" ON public.restaurant_campaigns
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "restaurant_campaigns_update" ON public.restaurant_campaigns
FOR UPDATE TO authenticated USING (
  public.is_admin() OR 
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);
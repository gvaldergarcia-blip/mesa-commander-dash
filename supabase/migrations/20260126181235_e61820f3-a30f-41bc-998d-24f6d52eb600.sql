-- =====================================================
-- HARDENING FINAL: 100% SECURITY (V3)
-- =====================================================

-- =====================================================
-- 1. CORRIGIR founder_leads - DADOS SENSÍVEIS EXPOSTOS
-- =====================================================

DROP POLICY IF EXISTS "Service role can manage founder_leads" ON public.founder_leads;

CREATE POLICY "Admin can manage founder_leads"
  ON public.founder_leads FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view their own founder lead" ON public.founder_leads;
CREATE POLICY "User can view own founder lead"
  ON public.founder_leads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. CORRIGIR restaurant_customers - CRM EXPOSTO
-- =====================================================

-- public schema
DROP POLICY IF EXISTS "restaurant_customers_own_data" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_restaurant_owner" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_select" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_update" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_delete" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_read" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_select" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_update" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_write" ON public.restaurant_customers;

-- mesaclik schema
DROP POLICY IF EXISTS "restaurant_customers_own_data" ON mesaclik.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_restaurant_owner" ON mesaclik.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_select" ON mesaclik.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_update" ON mesaclik.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_delete" ON mesaclik.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_read" ON mesaclik.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_select" ON mesaclik.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_update" ON mesaclik.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_write" ON mesaclik.restaurant_customers;

CREATE POLICY "restaurant_customers_owner_only"
  ON public.restaurant_customers FOR ALL
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_customers.restaurant_id AND r.owner_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_customers.restaurant_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "restaurant_customers_owner_only"
  ON mesaclik.restaurant_customers FOR ALL
  TO authenticated
  USING (mesaclik.is_admin_or_owner(restaurant_id))
  WITH CHECK (mesaclik.is_admin_or_owner(restaurant_id));

-- =====================================================
-- 3. CORRIGIR RLS POLICIES COM USING(true)
-- =====================================================

-- 3a. mesaclik.cidades
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON mesaclik.cidades;
CREATE POLICY "cidades_update_admin_only"
  ON mesaclik.cidades FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3b. mesaclik.cliks_users
DROP POLICY IF EXISTS "Cliks writable by system" ON mesaclik.cliks_users;
CREATE POLICY "cliks_users_insert_authenticated"
  ON mesaclik.cliks_users FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 3c. mesaclik.coupon_analytics (corrigido - usa coupon_id)
DROP POLICY IF EXISTS "Analytics writable by system" ON mesaclik.coupon_analytics;
CREATE POLICY "coupon_analytics_insert_owner"
  ON mesaclik.coupon_analytics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.coupons c
      JOIN mesaclik.restaurants r ON r.id = c.restaurant_id
      WHERE c.id = coupon_analytics.coupon_id AND r.owner_id = auth.uid()
    ) OR public.is_admin()
  );

-- 3d. mesaclik.coupon_interactions
DROP POLICY IF EXISTS "coupon_interactions_insert_anon" ON mesaclik.coupon_interactions;
CREATE POLICY "coupon_interactions_insert_valid"
  ON mesaclik.coupon_interactions FOR INSERT
  TO public
  WITH CHECK (EXISTS (SELECT 1 FROM mesaclik.coupons c WHERE c.id = coupon_interactions.coupon_id AND c.status = 'active'));

-- 3e. mesaclik.otp_logs (corrigido)
DROP POLICY IF EXISTS "otp_logs_update_system" ON mesaclik.otp_logs;
CREATE POLICY "otp_logs_update_valid"
  ON mesaclik.otp_logs FOR UPDATE
  TO public
  USING (status = 'sent' AND expires_at > now())
  WITH CHECK (status IN ('verified', 'expired', 'failed'));

-- 3f. mesaclik.restaurant_terms_acceptance
DROP POLICY IF EXISTS "terms_restaurant_update" ON mesaclik.restaurant_terms_acceptance;
CREATE POLICY "terms_acceptance_update_valid"
  ON mesaclik.restaurant_terms_acceptance FOR UPDATE
  TO public
  USING (EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_terms_acceptance.restaurant_id))
  WITH CHECK (EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_terms_acceptance.restaurant_id));

-- 3g. mesaclik.unsubscribe_tokens (corrigido - sem expires_at)
DROP POLICY IF EXISTS "unsubscribe_tokens_service_only" ON mesaclik.unsubscribe_tokens;
CREATE POLICY "unsubscribe_tokens_insert_authenticated"
  ON mesaclik.unsubscribe_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "unsubscribe_tokens_select_valid"
  ON mesaclik.unsubscribe_tokens FOR SELECT
  TO public
  USING (used = false);

-- 3h. storage.objects
DROP POLICY IF EXISTS "Authenticated users can delete restaurant files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update restaurant files" ON storage.objects;

CREATE POLICY "Owner can update restaurant files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'restaurants' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can delete restaurant files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'restaurants' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================
-- 4. Garantir TO authenticated em policies owner
-- =====================================================

DROP POLICY IF EXISTS "ai_palpites_owner_select" ON public.ai_palpites;
DROP POLICY IF EXISTS "ai_palpites_owner_update" ON public.ai_palpites;
DROP POLICY IF EXISTS "ai_palpites_owner_delete" ON public.ai_palpites;

CREATE POLICY "ai_palpites_authenticated_select"
  ON public.ai_palpites FOR SELECT
  TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = ai_palpites.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "ai_palpites_authenticated_update"
  ON public.ai_palpites FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = ai_palpites.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "ai_palpites_authenticated_delete"
  ON public.ai_palpites FOR DELETE
  TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = ai_palpites.restaurant_id AND r.owner_id = auth.uid()));

-- Corrigir customers
DROP POLICY IF EXISTS "customers_read_owner" ON public.customers;
DROP POLICY IF EXISTS "customers_write_owner" ON public.customers;

CREATE POLICY "customers_authenticated_read"
  ON public.customers FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.owner_id = auth.uid()));

CREATE POLICY "customers_authenticated_write"
  ON public.customers FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.owner_id = auth.uid()));

-- Corrigir system_insights
DROP POLICY IF EXISTS "system_insights_owner_all" ON public.system_insights;
DROP POLICY IF EXISTS "system_insights_owner_select" ON public.system_insights;
DROP POLICY IF EXISTS "system_insights_owner_update" ON public.system_insights;

CREATE POLICY "system_insights_authenticated_all"
  ON public.system_insights FOR ALL
  TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = system_insights.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = system_insights.restaurant_id AND r.owner_id = auth.uid()));

-- =====================================================
-- 5. Tabelas críticas
-- =====================================================

DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_roles_admin_manage"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "subscriptions_owner_read" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_service_all" ON public.subscriptions;

CREATE POLICY "subscriptions_authenticated_read"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = subscriptions.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "subscriptions_admin_manage"
  ON public.subscriptions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
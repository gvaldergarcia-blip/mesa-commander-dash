-- ========================================
-- MESACLIK SECURITY HARDENING - CORRIGIDO
-- ========================================

-- 1. Corrigir view v_reservations (adicionar security_invoker)
DROP VIEW IF EXISTS mesaclik.v_reservations;
CREATE VIEW mesaclik.v_reservations
WITH (security_invoker = true)
AS
SELECT 
  r.id,
  r.restaurant_id,
  r.user_id,
  r.name,
  r.customer_email,
  r.phone,
  r.party_size,
  r.reserved_for,
  r.status,
  r.notes,
  r.created_at,
  r.updated_at,
  r.confirmed_at,
  r.completed_at,
  r.canceled_at,
  r.no_show_at,
  r.canceled_by,
  r.cancel_reason
FROM mesaclik.reservations r;

-- 2. Restringir políticas de escrita em mesaclik

-- 2.1 coupon_publications - só owner pode escrever
DROP POLICY IF EXISTS "Publications writable by restaurant owner" ON mesaclik.coupon_publications;
CREATE POLICY "Publications writable by restaurant owner"
ON mesaclik.coupon_publications
FOR ALL
TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = coupon_publications.restaurant_id 
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = coupon_publications.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- 2.2 coupons - só owner pode escrever
DROP POLICY IF EXISTS "Coupons writable by restaurant owner" ON mesaclik.coupons;
CREATE POLICY "Coupons writable by restaurant owner"
ON mesaclik.coupons
FOR ALL
TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = coupons.restaurant_id 
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = coupons.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- 2.3 otp_logs - remover insert público (edge functions usam service_role)
DROP POLICY IF EXISTS "otp_logs_insert_system" ON mesaclik.otp_logs;

-- 2.4 coupon_analytics - via coupon_id -> coupons.restaurant_id
DROP POLICY IF EXISTS "Analytics readable by restaurant owner" ON mesaclik.coupon_analytics;
CREATE POLICY "Analytics readable by restaurant owner"
ON mesaclik.coupon_analytics
FOR SELECT
TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.coupons c
    JOIN mesaclik.restaurants r ON r.id = c.restaurant_id
    WHERE c.id = coupon_analytics.coupon_id
    AND r.owner_id = auth.uid()
  )
);

-- 2.5 coupon_audit_log - via coupon_id
DROP POLICY IF EXISTS "Audit log readable by restaurant owner" ON mesaclik.coupon_audit_log;
CREATE POLICY "Audit log readable by restaurant owner"
ON mesaclik.coupon_audit_log
FOR SELECT
TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.coupons c
    JOIN mesaclik.restaurants r ON r.id = c.restaurant_id
    WHERE c.id = coupon_audit_log.coupon_id
    AND r.owner_id = auth.uid()
  )
);

-- 2.6 email_preferences_audit - via customer_id (usando tabela correta public.customers)
DROP POLICY IF EXISTS "email_preferences_audit_select" ON mesaclik.email_preferences_audit;
DROP POLICY IF EXISTS "email_prefs_audit_select_all" ON mesaclik.email_preferences_audit;
CREATE POLICY "email_preferences_audit_owner"
ON mesaclik.email_preferences_audit
FOR SELECT
TO authenticated
USING (
  public.is_admin() OR who = auth.uid()
);
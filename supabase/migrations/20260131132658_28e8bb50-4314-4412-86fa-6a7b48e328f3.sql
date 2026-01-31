-- ========================================
-- MESACLIK SECURITY HARDENING - PARTE 3
-- Corrigir últimas políticas WITH CHECK (true)
-- ========================================

-- 1. restaurant_calendar - remover política permissiva e manter apenas a restritiva
DROP POLICY IF EXISTS "Restaurant owners can manage calendar" ON mesaclik.restaurant_calendar;

-- 2. restaurant_terms_acceptance - restringir insert para restaurante válido
DROP POLICY IF EXISTS "terms_restaurant_insert" ON mesaclik.restaurant_terms_acceptance;
CREATE POLICY "terms_restaurant_insert"
ON mesaclik.restaurant_terms_acceptance
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_terms_acceptance.restaurant_id
  )
);

-- 3. restaurant_customers - restringir insert/update ao owner
DROP POLICY IF EXISTS "restaurant_customers_insert_update" ON public.restaurant_customers;
CREATE POLICY "restaurant_customers_insert_update"
ON public.restaurant_customers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_customers.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "restaurant_customers_update" ON public.restaurant_customers;
CREATE POLICY "restaurant_customers_update_owner"
ON public.restaurant_customers
FOR UPDATE
TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_customers.restaurant_id 
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_customers.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- 4. restaurant_marketing_optins - restringir ao restaurante válido
DROP POLICY IF EXISTS "anon_update_restaurant_marketing_optins" ON public.restaurant_marketing_optins;
CREATE POLICY "marketing_optins_update"
ON public.restaurant_marketing_optins
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_marketing_optins.restaurant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_marketing_optins.restaurant_id
  )
);

DROP POLICY IF EXISTS "anon_insert_restaurant_marketing_optins" ON public.restaurant_marketing_optins;
CREATE POLICY "marketing_optins_insert"
ON public.restaurant_marketing_optins
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_marketing_optins.restaurant_id
  )
);

-- 5. profiles (service_role) - essas são para o service_role, são seguras mas vamos documentar
-- Nota: as políticas service_role_can_* são para triggers e processos internos, são seguras
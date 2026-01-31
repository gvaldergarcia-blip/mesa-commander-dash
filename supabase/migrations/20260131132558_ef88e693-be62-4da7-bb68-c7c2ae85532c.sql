-- ========================================
-- MESACLIK SECURITY HARDENING - PARTE 2
-- Remover políticas WITH CHECK (true) restantes
-- ========================================

-- 1. Restringir restaurant_calendar escrita
DROP POLICY IF EXISTS "Calendar writable by restaurant owner" ON mesaclik.restaurant_calendar;
CREATE POLICY "Calendar writable by restaurant owner"
ON mesaclik.restaurant_calendar
FOR ALL
TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_calendar.restaurant_id 
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_calendar.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- 2. Restringir cliks_program escrita
DROP POLICY IF EXISTS "Program writable by restaurant owner" ON mesaclik.cliks_program;
CREATE POLICY "Program writable by restaurant owner"
ON mesaclik.cliks_program
FOR ALL
TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = cliks_program.restaurant_id 
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = cliks_program.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- 3. Remover políticas duplicadas permissivas em public.email_preferences_audit
DROP POLICY IF EXISTS "email_prefs_audit_select_all" ON public.email_preferences_audit;

-- 4. Restringir promotions (public) escrita
DROP POLICY IF EXISTS "tenant_write" ON public.promotions;
CREATE POLICY "promotions_tenant_write"
ON public.promotions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = promotions.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- 5. Remover políticas duplicadas em mesaclik.promotions
DROP POLICY IF EXISTS "tenant_write" ON mesaclik.promotions;
DROP POLICY IF EXISTS "promotions_select_public" ON mesaclik.promotions;
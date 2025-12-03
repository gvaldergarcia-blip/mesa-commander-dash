-- ============================================
-- ISOLAMENTO MULTI-TENANT COMPLETO (CORRIGIDO)
-- ============================================

-- Continuar de onde parou - Queue entries e Reservations

-- 5. QUEUE_ENTRIES - Leitura pública, escrita isolada por restaurante
DROP POLICY IF EXISTS "queue_entries_select_public" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_manage_own_restaurant" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_user_own" ON public.queue_entries;
DROP POLICY IF EXISTS "qe_delete_owner_active" ON public.queue_entries;
DROP POLICY IF EXISTS "qe_insert_owner" ON public.queue_entries;
DROP POLICY IF EXISTS "qe_select_owner" ON public.queue_entries;
DROP POLICY IF EXISTS "qe_update_owner_active" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_cancel_own" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_insert_own" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_insert_self" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_select_self" ON public.queue_entries;

CREATE POLICY "queue_entries_select_public"
ON public.queue_entries FOR SELECT
USING (true);

CREATE POLICY "queue_entries_manage_own_restaurant"
ON public.queue_entries FOR ALL
TO authenticated
USING (
  queue_id IN (
    SELECT q.id FROM public.queues q 
    JOIN public.restaurants r ON r.id = q.restaurant_id 
    WHERE r.owner_id = auth.uid()
  )
)
WITH CHECK (
  queue_id IN (
    SELECT q.id FROM public.queues q 
    JOIN public.restaurants r ON r.id = q.restaurant_id 
    WHERE r.owner_id = auth.uid()
  )
);

-- Permitir usuários gerenciarem suas próprias entradas via customer_id
CREATE POLICY "queue_entries_customer_own"
ON public.queue_entries FOR ALL
TO authenticated
USING (customer_id IS NOT NULL)
WITH CHECK (true);

-- 6. RESERVATIONS - Leitura pública, escrita isolada
DROP POLICY IF EXISTS "reservations_select_public" ON public.reservations;
DROP POLICY IF EXISTS "reservations_manage_own_restaurant" ON public.reservations;
DROP POLICY IF EXISTS "reservations_user_own" ON public.reservations;
DROP POLICY IF EXISTS "panel_can_create_reservations" ON public.reservations;
DROP POLICY IF EXISTS "panel_can_update_reservations" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_blocked_by_penalty" ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_self" ON public.reservations;
DROP POLICY IF EXISTS "reservations_read_own" ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_own" ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_own" ON public.reservations;
DROP POLICY IF EXISTS "rv_delete_owner_active" ON public.reservations;
DROP POLICY IF EXISTS "rv_insert_owner" ON public.reservations;
DROP POLICY IF EXISTS "rv_select_owner" ON public.reservations;
DROP POLICY IF EXISTS "rv_update_owner_active" ON public.reservations;
DROP POLICY IF EXISTS "upd_own_reservation" ON public.reservations;

CREATE POLICY "reservations_select_public"
ON public.reservations FOR SELECT
USING (true);

CREATE POLICY "reservations_manage_own_restaurant"
ON public.reservations FOR ALL
TO authenticated
USING (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
)
WITH CHECK (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
);

-- Permitir usuários gerenciarem suas próprias reservas
CREATE POLICY "reservations_user_own"
ON public.reservations FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
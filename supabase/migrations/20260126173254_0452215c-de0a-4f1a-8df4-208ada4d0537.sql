-- =========================================
-- SECURITY FIX PHASE 2: OPERATIONAL TABLES
-- Remove overly permissive RLS policies
-- Add strict owner-based access control
-- =========================================

-- =========================================
-- 1. FIX: queue_entries TABLE
-- Remove permissive policies, keep owner-based
-- =========================================

-- Remove overly permissive policies
DROP POLICY IF EXISTS "Queue entries readable by restaurant owner" ON public.queue_entries;
DROP POLICY IF EXISTS "Queue entries writable by restaurant owner" ON public.queue_entries;
DROP POLICY IF EXISTS "Queue entries are viewable by everyone" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can view queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can insert queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_select_public" ON public.queue_entries;
DROP POLICY IF EXISTS "queue_entries_customer_own" ON public.queue_entries;

-- Create strict policies for queue_entries
-- Owner can manage all entries in their restaurant's queues
CREATE POLICY "queue_entries_owner_select"
  ON public.queue_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN mesaclik.restaurants r ON r.id = q.restaurant_id
      WHERE q.id = queue_entries.queue_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "queue_entries_owner_insert"
  ON public.queue_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN mesaclik.restaurants r ON r.id = q.restaurant_id
      WHERE q.id = queue_entries.queue_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "queue_entries_owner_update"
  ON public.queue_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN mesaclik.restaurants r ON r.id = q.restaurant_id
      WHERE q.id = queue_entries.queue_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN mesaclik.restaurants r ON r.id = q.restaurant_id
      WHERE q.id = queue_entries.queue_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "queue_entries_owner_delete"
  ON public.queue_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN mesaclik.restaurants r ON r.id = q.restaurant_id
      WHERE q.id = queue_entries.queue_id
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- 2. FIX: queues TABLE
-- Remove permissive policies
-- =========================================

DROP POLICY IF EXISTS "Queues readable by restaurant owner" ON public.queues;
DROP POLICY IF EXISTS "Queues writable by restaurant owner" ON public.queues;
DROP POLICY IF EXISTS "Queues are viewable by everyone" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues" ON public.queues;
DROP POLICY IF EXISTS "Users can insert queues" ON public.queues;
DROP POLICY IF EXISTS "queues_read" ON public.queues;

-- Create strict policies for queues
CREATE POLICY "queues_owner_select"
  ON public.queues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = queues.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "queues_owner_insert"
  ON public.queues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = queues.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "queues_owner_update"
  ON public.queues
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = queues.restaurant_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = queues.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "queues_owner_delete"
  ON public.queues
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = queues.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- 3. FIX: reservations TABLE
-- Remove permissive policies
-- =========================================

DROP POLICY IF EXISTS "Reservations readable by restaurant owner" ON public.reservations;
DROP POLICY IF EXISTS "Reservations writable by restaurant owner" ON public.reservations;
DROP POLICY IF EXISTS "Reservations are viewable by everyone" ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_public" ON public.reservations;

-- Create strict policies for reservations
CREATE POLICY "reservations_owner_select"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = reservations.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "reservations_owner_insert"
  ON public.reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = reservations.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "reservations_owner_update_new"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = reservations.restaurant_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = reservations.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "reservations_owner_delete"
  ON public.reservations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = reservations.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- 4. FIX: promotions TABLE
-- Remove permissive policies
-- =========================================

DROP POLICY IF EXISTS "Promotions readable by restaurant owner" ON public.promotions;
DROP POLICY IF EXISTS "Promotions writable by restaurant owner" ON public.promotions;
DROP POLICY IF EXISTS "Allow insert promotions" ON public.promotions;
DROP POLICY IF EXISTS "promotions_select_public" ON public.promotions;
DROP POLICY IF EXISTS "tenant_read" ON public.promotions;
DROP POLICY IF EXISTS "tenant_write" ON public.promotions;

-- Create strict policies for promotions
CREATE POLICY "promotions_owner_select"
  ON public.promotions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = promotions.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "promotions_owner_insert"
  ON public.promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = promotions.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "promotions_owner_update"
  ON public.promotions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = promotions.restaurant_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = promotions.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "promotions_owner_delete"
  ON public.promotions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = promotions.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- 5. FIX: system_insights TABLE
-- Remove anon policies
-- =========================================

DROP POLICY IF EXISTS "system_insights_anon_select" ON public.system_insights;
DROP POLICY IF EXISTS "system_insights_anon_update" ON public.system_insights;

-- Create strict policies
CREATE POLICY "system_insights_owner_select"
  ON public.system_insights
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = system_insights.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "system_insights_owner_update"
  ON public.system_insights
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = system_insights.restaurant_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = system_insights.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- 6. FIX: audit_logs TABLE
-- Already has owner-only policy, just clean up
-- =========================================

-- Audit logs should only be service-insertable and owner-readable
-- The existing policies are already correct

-- =========================================
-- SUMMARY OF PHASE 2 CHANGES:
-- ✅ queue_entries: Owner-only via queue->restaurant join
-- ✅ queues: Owner-only access
-- ✅ reservations: Owner-only access
-- ✅ promotions: Owner-only access
-- ✅ system_insights: Owner-only access (removed anon)
-- =========================================
-- =========================================
-- SECURITY FIX PHASE 1: CRITICAL TABLES
-- Remove overly permissive RLS policies
-- Add strict owner-based access control
-- =========================================

-- =========================================
-- 1. FIX: customers TABLE
-- Remove all permissive policies
-- =========================================

DROP POLICY IF EXISTS "Customers readable by restaurant owner" ON public.customers;
DROP POLICY IF EXISTS "Customers writable by restaurant owner" ON public.customers;
DROP POLICY IF EXISTS "customers_read_owner" ON public.customers;
DROP POLICY IF EXISTS "customers_write_owner" ON public.customers;

-- Create strict policies for customers (requires joining through restaurant_customers for restaurant context)
-- Since customers table doesn't have restaurant_id, we use restaurant_customers as bridge
CREATE POLICY "customers_select_via_restaurant_membership"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_customers rc
      JOIN mesaclik.restaurants r ON r.id = rc.restaurant_id
      WHERE rc.customer_phone = customers.phone
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "customers_insert_authenticated"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "customers_update_via_restaurant_membership"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_customers rc
      JOIN mesaclik.restaurants r ON r.id = rc.restaurant_id
      WHERE rc.customer_phone = customers.phone
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- 2. FIX: ai_palpites TABLE
-- Remove anon read policy
-- =========================================

DROP POLICY IF EXISTS "ai_palpites_anon_read" ON public.ai_palpites;

-- Keep owner policy but make it stricter
DROP POLICY IF EXISTS "ai_palpites_owner_all" ON public.ai_palpites;

CREATE POLICY "ai_palpites_owner_select"
  ON public.ai_palpites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = ai_palpites.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "ai_palpites_owner_update"
  ON public.ai_palpites
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = ai_palpites.restaurant_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = ai_palpites.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "ai_palpites_owner_delete"
  ON public.ai_palpites
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = ai_palpites.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- Keep insert policy for system (generate_ai_palpites function)
DROP POLICY IF EXISTS "ai_palpites_insert_system" ON public.ai_palpites;
CREATE POLICY "ai_palpites_insert_system"
  ON public.ai_palpites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = ai_palpites.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- 3. FIX: email_logs TABLE
-- Remove permissive anon policies
-- =========================================

DROP POLICY IF EXISTS "email_logs_insert_all" ON public.email_logs;
DROP POLICY IF EXISTS "email_logs_select_all" ON public.email_logs;
DROP POLICY IF EXISTS "email_logs_update_all" ON public.email_logs;

-- Keep owner policy
-- email_logs_restaurant_owner already exists, but ensure it works

-- =========================================
-- 4. FIX: restaurant_campaigns TABLE
-- Remove anon policies
-- =========================================

DROP POLICY IF EXISTS "restaurant_campaigns_anon_insert" ON public.restaurant_campaigns;
DROP POLICY IF EXISTS "restaurant_campaigns_anon_select" ON public.restaurant_campaigns;
DROP POLICY IF EXISTS "restaurant_campaigns_anon_update" ON public.restaurant_campaigns;

-- =========================================
-- 5. FIX: restaurant_campaign_recipients TABLE
-- Remove anon policies
-- =========================================

DROP POLICY IF EXISTS "restaurant_campaign_recipients_anon_insert" ON public.restaurant_campaign_recipients;
DROP POLICY IF EXISTS "restaurant_campaign_recipients_anon_select" ON public.restaurant_campaign_recipients;
DROP POLICY IF EXISTS "restaurant_campaign_recipients_anon_update" ON public.restaurant_campaign_recipients;

-- =========================================
-- 6. FIX: restaurant_customers TABLE
-- Remove anon policies, add owner policies
-- =========================================

DROP POLICY IF EXISTS "restaurant_customers_anon_insert" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_anon_select" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_anon_update" ON public.restaurant_customers;

-- Add strict owner-based policies
CREATE POLICY "restaurant_customers_owner_select"
  ON public.restaurant_customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_customers.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "restaurant_customers_owner_insert"
  ON public.restaurant_customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_customers.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "restaurant_customers_owner_update"
  ON public.restaurant_customers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_customers.restaurant_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_customers.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "restaurant_customers_owner_delete"
  ON public.restaurant_customers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_customers.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- 7. FIX: customer_metrics TABLE
-- Remove permissive upsert policy
-- =========================================

DROP POLICY IF EXISTS "customer_metrics_upsert_all" ON public.customer_metrics;

CREATE POLICY "customer_metrics_owner_write"
  ON public.customer_metrics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = customer_metrics.restaurant_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = customer_metrics.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- Allow triggers to update metrics (system operations)
CREATE POLICY "customer_metrics_trigger_insert"
  ON public.customer_metrics
  FOR INSERT
  TO postgres
  WITH CHECK (true);

-- =========================================
-- 8. FIX: customer_events TABLE
-- Remove permissive insert policy
-- =========================================

DROP POLICY IF EXISTS "customer_events_insert_all" ON public.customer_events;

CREATE POLICY "customer_events_owner_insert"
  ON public.customer_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = customer_events.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- =========================================
-- SUMMARY OF CHANGES:
-- ✅ customers: Only visible to restaurant owners
-- ✅ ai_palpites: Only owner can see their palpites
-- ✅ email_logs: Removed anon access
-- ✅ restaurant_campaigns: Removed anon access
-- ✅ restaurant_campaign_recipients: Removed anon access
-- ✅ restaurant_customers: Owner-only access
-- ✅ customer_metrics: Owner-only access
-- ✅ customer_events: Owner-only insert
-- =========================================
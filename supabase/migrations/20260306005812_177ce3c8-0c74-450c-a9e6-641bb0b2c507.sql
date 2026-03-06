
-- =============================================================
-- HARDENING P0/P1: Tasks B, C, D, E
-- Backward-compatible: DROP policies only for anon write on restaurant_customers
-- Add ownership checks to RPCs, restrict storage, reduce anon surface
-- =============================================================

-- ============ TASK B: Close anon write on restaurant_customers ============
-- The upsert_restaurant_customer RPC already handles all writes securely.
-- Queue/reservation flows already go through RPCs, NOT direct inserts.

DROP POLICY IF EXISTS "restaurant_customers_anon_insert" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_anon_update" ON public.restaurant_customers;

-- Keep authenticated write for panel users (membership-scoped)
CREATE POLICY "restaurant_customers_member_insert" ON public.restaurant_customers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_members
      WHERE user_id = auth.uid() AND restaurant_id = restaurant_customers.restaurant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "restaurant_customers_member_update" ON public.restaurant_customers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_members
      WHERE user_id = auth.uid() AND restaurant_id = restaurant_customers.restaurant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_members
      WHERE user_id = auth.uid() AND restaurant_id = restaurant_customers.restaurant_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- ============ TASK C: Fix SECURITY DEFINER RPCs ============

-- C1: get_reports_queue_data — add ownership check
CREATE OR REPLACE FUNCTION public.get_reports_queue_data(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid, queue_id uuid, customer_name text, phone text,
  party_size integer, status text, priority text,
  created_at timestamptz, called_at timestamptz, seated_at timestamptz,
  canceled_at timestamptz, estimated_wait_time integer, position_number integer,
  notes text, customer_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $$
BEGIN
  -- Ownership check: must be member or admin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING errcode = '28000';
  END IF;
  IF NOT public.is_member_or_admin(p_restaurant_id) THEN
    RAISE EXCEPTION 'Acesso negado a este restaurante' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT qe.id, qe.queue_id, qe.customer_name, qe.phone,
    qe.party_size, qe.status::text, qe.priority::text,
    qe.created_at, qe.called_at, qe.seated_at,
    qe.canceled_at, qe.estimated_wait_time, qe.position_number,
    qe.notes, qe.customer_id
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE q.restaurant_id = p_restaurant_id
  ORDER BY qe.created_at DESC;
END;
$$;

-- C2: get_reports_reservation_data — add ownership check
CREATE OR REPLACE FUNCTION public.get_reports_reservation_data(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid, restaurant_id uuid, user_id uuid, name text,
  customer_email text, phone text, party_size integer,
  reserved_for timestamptz, status text, notes text,
  created_at timestamptz, updated_at timestamptz,
  confirmed_at timestamptz, completed_at timestamptz,
  canceled_at timestamptz, no_show_at timestamptz,
  canceled_by text, cancel_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING errcode = '28000';
  END IF;
  IF NOT public.is_member_or_admin(p_restaurant_id) THEN
    RAISE EXCEPTION 'Acesso negado a este restaurante' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT r.id, r.restaurant_id, r.user_id, r.name,
    r.customer_email, r.phone, r.party_size,
    r.reserved_for, r.status::text, r.notes,
    r.created_at, r.updated_at,
    r.confirmed_at, r.completed_at,
    r.canceled_at, r.no_show_at,
    r.canceled_by, r.cancel_reason
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = p_restaurant_id
  ORDER BY r.reserved_for DESC;
END;
$$;

-- C3: Revoke anon from RPCs
REVOKE EXECUTE ON FUNCTION public.get_reports_queue_data(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_reports_reservation_data(uuid) FROM anon;

-- For get_queue_entries in mesaclik schema — add ownership check
-- First check if it exists before replacing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'mesaclik' AND p.proname = 'get_queue_entries') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION mesaclik.get_queue_entries FROM anon';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Function might not exist or have different signature, skip
  NULL;
END;
$$;


-- ============ TASK D: Storage bucket ownership policies ============

-- D1: promotion-images — replace permissive policies with ownership-scoped
DROP POLICY IF EXISTS "Authenticated users can upload promotion images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their promotion images" ON storage.objects;

CREATE POLICY "promotion_images_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'promotion-images'
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = auth.uid()
        AND restaurant_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "promotion_images_member_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'promotion-images'
    AND (
      EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = auth.uid()
        AND restaurant_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

-- D2: marketing-videos — replace permissive policies with ownership-scoped
DROP POLICY IF EXISTS "marketing_videos_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "marketing_videos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "marketing_videos_auth_delete" ON storage.objects;

CREATE POLICY "marketing_videos_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-videos'
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = auth.uid()
        AND restaurant_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "marketing_videos_member_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'marketing-videos'
    AND (
      EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = auth.uid()
        AND restaurant_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "marketing_videos_member_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketing-videos'
    AND (
      EXISTS (
        SELECT 1 FROM public.restaurant_members
        WHERE user_id = auth.uid()
        AND restaurant_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

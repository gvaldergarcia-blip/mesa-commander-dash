-- ============================================
-- SECURITY HARDENING: DEFINER FUNCTIONS
-- ============================================
-- Add ownership validation to all SECURITY DEFINER functions
-- Revoke anon access from critical functions
-- ============================================

-- 1) add_customer_to_queue - Recreate with ownership check
DROP FUNCTION IF EXISTS mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text);

CREATE FUNCTION mesaclik.add_customer_to_queue(
  p_restaurant_id uuid,
  p_queue_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_party_size integer DEFAULT 2,
  p_notes text DEFAULT NULL
)
RETURNS mesaclik.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
DECLARE
  v_entry mesaclik.queue_entries;
  v_position integer;
BEGIN
  -- OWNERSHIP CHECK: Verify caller owns this restaurant
  IF NOT EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = p_restaurant_id 
    AND r.owner_id = auth.uid()
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this restaurant';
  END IF;

  -- Validate restaurant exists and has queue enabled
  IF NOT EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = p_restaurant_id AND r.has_queue = true
  ) THEN
    RAISE EXCEPTION 'Restaurant not found or queue not enabled';
  END IF;

  -- Validate queue belongs to restaurant
  IF NOT EXISTS (
    SELECT 1 FROM mesaclik.queues q 
    WHERE q.id = p_queue_id AND q.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Queue not found for this restaurant';
  END IF;

  -- Calculate position
  SELECT COALESCE(MAX(position_number), 0) + 1 INTO v_position
  FROM mesaclik.queue_entries
  WHERE queue_id = p_queue_id AND status = 'waiting';

  -- Insert entry
  INSERT INTO mesaclik.queue_entries (
    queue_id, customer_name, phone, party_size, notes, position_number, status
  ) VALUES (
    p_queue_id, p_customer_name, p_customer_email, p_party_size, p_notes, v_position, 'waiting'
  )
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$function$;

-- Revoke anon, grant only to authenticated
REVOKE EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION mesaclik.add_customer_to_queue(uuid, uuid, text, text, integer, text) TO authenticated;


-- 2) update_queue_entry_status_v2 - Recreate with ownership check
DROP FUNCTION IF EXISTS mesaclik.update_queue_entry_status_v2(uuid, text);

CREATE FUNCTION mesaclik.update_queue_entry_status_v2(
  p_entry_id uuid,
  p_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
DECLARE
  v_entry mesaclik.queue_entries;
  v_new_status public.queue_status;
  v_restaurant_id uuid;
BEGIN
  -- Get restaurant_id for ownership check
  SELECT q.restaurant_id INTO v_restaurant_id
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE qe.id = p_entry_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Queue entry not found';
  END IF;

  -- OWNERSHIP CHECK: Verify caller owns this restaurant
  IF NOT EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = v_restaurant_id 
    AND r.owner_id = auth.uid()
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this restaurant';
  END IF;

  -- Cast status
  v_new_status := p_status::public.queue_status;

  -- Update entry
  UPDATE mesaclik.queue_entries
  SET 
    status = v_new_status,
    updated_at = now(),
    called_at = CASE WHEN v_new_status = 'called' THEN now() ELSE called_at END,
    seated_at = CASE WHEN v_new_status = 'seated' THEN now() ELSE seated_at END,
    canceled_at = CASE WHEN v_new_status IN ('canceled', 'no_show') THEN now() ELSE canceled_at END
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  RETURN row_to_json(v_entry);
END;
$function$;

-- Revoke anon, grant only to authenticated
REVOKE EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(uuid, text) TO authenticated;


-- 3) update_reservation_status_panel - Recreate with ownership check
DROP FUNCTION IF EXISTS public.update_reservation_status_panel(uuid, mesaclik.reservation_status, text);

CREATE FUNCTION public.update_reservation_status_panel(
  p_reservation_id uuid,
  p_status mesaclik.reservation_status,
  p_cancel_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
DECLARE
  v_reservation mesaclik.reservations;
  v_restaurant_id uuid;
BEGIN
  -- Get restaurant_id for ownership check
  SELECT restaurant_id INTO v_restaurant_id
  FROM mesaclik.reservations
  WHERE id = p_reservation_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  -- OWNERSHIP CHECK: Verify caller owns this restaurant
  IF NOT EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = v_restaurant_id 
    AND r.owner_id = auth.uid()
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this restaurant';
  END IF;

  -- Update reservation
  UPDATE mesaclik.reservations
  SET 
    status = p_status,
    cancel_reason = COALESCE(p_cancel_reason, cancel_reason),
    updated_at = now(),
    canceled_at = CASE WHEN p_status = 'canceled' THEN now() ELSE canceled_at END,
    canceled_by = CASE WHEN p_status = 'canceled' THEN 'panel' ELSE canceled_by END
  WHERE id = p_reservation_id
  RETURNING * INTO v_reservation;

  RETURN row_to_json(v_reservation);
END;
$function$;

-- Revoke anon, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.update_reservation_status_panel(uuid, mesaclik.reservation_status, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_reservation_status_panel(uuid, mesaclik.reservation_status, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_reservation_status_panel(uuid, mesaclik.reservation_status, text) TO authenticated;


-- 4) Remove overly permissive anonymous policies on sensitive tables
DROP POLICY IF EXISTS "anon_insert_queue_terms_consents" ON public.queue_terms_consents;
DROP POLICY IF EXISTS "anon_update_queue_terms_consents" ON public.queue_terms_consents;
DROP POLICY IF EXISTS "system_insights_anon_select" ON public.system_insights;
DROP POLICY IF EXISTS "system_insights_anon_insert" ON public.system_insights;
DROP POLICY IF EXISTS "system_insights_anon_update" ON public.system_insights;

-- 5) Replace with proper authenticated-only policies for system_insights
DROP POLICY IF EXISTS "system_insights_authenticated_select" ON public.system_insights;
DROP POLICY IF EXISTS "system_insights_authenticated_insert" ON public.system_insights;
DROP POLICY IF EXISTS "system_insights_authenticated_update" ON public.system_insights;

CREATE POLICY "system_insights_authenticated_select" ON public.system_insights
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r 
      WHERE r.id = system_insights.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "system_insights_authenticated_insert" ON public.system_insights
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r 
      WHERE r.id = system_insights.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "system_insights_authenticated_update" ON public.system_insights
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r 
      WHERE r.id = system_insights.restaurant_id 
      AND r.owner_id = auth.uid()
    )
  );
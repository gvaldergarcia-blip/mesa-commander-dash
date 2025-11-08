-- ============================================
-- MESACLIK - CORREÇÃO FINAL DE FUNÇÕES (FIXED v2)
-- ============================================
-- Drop + recreate com search_path
-- Data: 2025-11-08
-- ============================================

-- ==========================================
-- PARTE 1: DROP FUNÇÕES CONFLITANTES
-- ==========================================

DROP FUNCTION IF EXISTS mesaclik.cancel_reservation(uuid, uuid);
DROP FUNCTION IF EXISTS mesaclik.cancel_reservation(uuid, text, text);
DROP FUNCTION IF EXISTS mesaclik.cancel_reservation(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.cancel_reservation(uuid, uuid, text);
DROP FUNCTION IF EXISTS mesaclik.cancel_queue_entry(uuid, uuid, text);
DROP FUNCTION IF EXISTS mesaclik.direct_cancel_reservation(uuid, text, text);
DROP FUNCTION IF EXISTS mesaclik.force_cancel_reservation(uuid, text, text);
DROP FUNCTION IF EXISTS mesaclik.simple_cancel_reservation(uuid, text, text);
DROP FUNCTION IF EXISTS mesaclik.ultimate_cancel_reservation(uuid, text, text);
DROP FUNCTION IF EXISTS mesaclik.get_active_coupons_for_app();
DROP FUNCTION IF EXISTS mesaclik.log_reservation_update();


-- ==========================================
-- PARTE 2: RECRIAR FUNÇÕES COM SEARCH_PATH
-- ==========================================

-- 1) mesaclik.cancel_queue_entry
CREATE FUNCTION mesaclik.cancel_queue_entry(
  p_ticket_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.queue_entries
  SET 
    status = 'cancelled',
    cancelled_by = p_user_id::text,
    cancel_reason = p_reason,
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_ticket_id
    AND user_id = p_user_id
    AND status = 'waiting';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No waiting ticket found for given ticket/user'
      USING errcode = 'P0001';
  END IF;
END;
$$;

-- 2) mesaclik.cancel_reservation (JSON return)
CREATE FUNCTION mesaclik.cancel_reservation(
  reservation_id uuid,
  canceled_by_param text DEFAULT 'user',
  cancel_reason_param text DEFAULT 'user_cancel'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
DECLARE
  result JSON;
  updated_reservation mesaclik.reservations%ROWTYPE;
BEGIN
  UPDATE mesaclik.reservations 
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_by = canceled_by_param,
    cancel_reason = cancel_reason_param,
    updated_at = NOW()
  WHERE id = reservation_id
  RETURNING * INTO updated_reservation;
  
  IF updated_reservation.id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found: %', reservation_id;
  END IF;
  
  SELECT to_json(row_to_json(updated_reservation)) INTO result;
  RETURN result;
END;
$$;

-- 3) mesaclik.cancel_reservation (TABLE return)
CREATE FUNCTION mesaclik.cancel_reservation(
  p_reservation_id uuid,
  p_user_id uuid,
  p_cancel_reason text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  status mesaclik.reservation_status,
  canceled_at timestamptz,
  canceled_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  RETURN QUERY
  UPDATE mesaclik.reservations r
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_by = 'user',
    cancel_reason = p_cancel_reason,
    updated_at = NOW()
  WHERE r.id = p_reservation_id
    AND r.user_id = p_user_id
  RETURNING r.id, r.status, r.canceled_at, r.canceled_by;
END;
$$;

-- 4) public.cancel_reservation (wrapper)
CREATE FUNCTION public.cancel_reservation(
  p_reservation_id uuid,
  p_user_id uuid,
  p_cancel_reason text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  status mesaclik.reservation_status,
  canceled_at timestamptz,
  canceled_by text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
  SELECT * FROM mesaclik.cancel_reservation(p_reservation_id, p_user_id, p_cancel_reason);
$$;

-- 5) mesaclik.direct_cancel_reservation
CREATE FUNCTION mesaclik.direct_cancel_reservation(
  p_reservation_id uuid,
  p_canceled_by text DEFAULT 'user',
  p_cancel_reason text DEFAULT 'user_cancel'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.reservations
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_by = p_canceled_by,
    cancel_reason = p_cancel_reason,
    updated_at = NOW()
  WHERE id = p_reservation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
END;
$$;

-- 6) mesaclik.force_cancel_reservation
CREATE FUNCTION mesaclik.force_cancel_reservation(
  p_reservation_id uuid,
  p_canceled_by text DEFAULT 'user',
  p_cancel_reason text DEFAULT 'user_cancel'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.reservations
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_by = p_canceled_by,
    cancel_reason = p_cancel_reason,
    updated_at = NOW()
  WHERE id = p_reservation_id;
END;
$$;

-- 7) mesaclik.simple_cancel_reservation
CREATE FUNCTION mesaclik.simple_cancel_reservation(
  p_reservation_id uuid,
  p_canceled_by text DEFAULT 'user',
  p_cancel_reason text DEFAULT 'user_cancel'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.reservations
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_by = p_canceled_by,
    cancel_reason = p_cancel_reason
  WHERE id = p_reservation_id;
END;
$$;

-- 8) mesaclik.ultimate_cancel_reservation
CREATE FUNCTION mesaclik.ultimate_cancel_reservation(
  p_reservation_id uuid,
  p_canceled_by text DEFAULT 'user',
  p_cancel_reason text DEFAULT 'user_cancel'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.reservations
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_by = p_canceled_by,
    cancel_reason = p_cancel_reason,
    updated_at = NOW()
  WHERE id = p_reservation_id;
END;
$$;

-- 9) mesaclik.get_active_coupons_for_app (CORRIGIDO)
CREATE FUNCTION mesaclik.get_active_coupons_for_app()
RETURNS SETOF mesaclik.coupons
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
  SELECT * FROM mesaclik.coupons
  WHERE status = 'active';
$$;

-- 10) mesaclik.log_reservation_update
CREATE FUNCTION mesaclik.log_reservation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  RETURN NEW;
END;
$$;


-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON FUNCTION mesaclik.cancel_queue_entry IS 'Cancela entrada na fila - protegido com search_path';
COMMENT ON FUNCTION mesaclik.cancel_reservation(uuid, text, text) IS 'Cancela reserva - retorna JSON';
COMMENT ON FUNCTION mesaclik.cancel_reservation(uuid, uuid, text) IS 'Cancela reserva - retorna TABLE';
COMMENT ON FUNCTION mesaclik.get_active_coupons_for_app IS 'Lista cupons ativos';
COMMENT ON FUNCTION mesaclik.log_reservation_update IS 'Trigger helper';

-- ==========================================
-- FIM
-- ==========================================
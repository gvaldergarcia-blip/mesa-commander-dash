-- ========================================
-- HARDENING 100% - PARTE A: DROP FUNÇÕES COM CONFLITO
-- ========================================

-- Drop funções que precisam ser recriadas com search_path
DROP FUNCTION IF EXISTS mesaclik.enter_queue(uuid, uuid, integer, text, text, text);
DROP FUNCTION IF EXISTS mesaclik.expire_coupons();
DROP FUNCTION IF EXISTS mesaclik.activate_scheduled_coupons();
DROP FUNCTION IF EXISTS mesaclik.cleanup_old_audit_logs(integer);
DROP FUNCTION IF EXISTS mesaclik.cancel_reservation(uuid, uuid, text);

-- ========================================
-- PARTE B: RECRIAR FUNÇÕES COM SEARCH_PATH
-- ========================================

-- 1) enter_queue (mesaclik)
CREATE FUNCTION mesaclik.enter_queue(
  p_restaurant_id uuid,
  p_user_id uuid,
  p_party_size integer,
  p_name text,
  p_phone text,
  p_email text
)
RETURNS mesaclik.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
DECLARE
  v_queue_id uuid;
  v_entry mesaclik.queue_entries;
BEGIN
  SELECT id INTO v_queue_id
  FROM mesaclik.queues
  WHERE restaurant_id = p_restaurant_id AND is_active = true
  LIMIT 1;
  
  IF v_queue_id IS NULL THEN
    INSERT INTO mesaclik.queues (restaurant_id, name, is_active)
    VALUES (p_restaurant_id, 'Main Queue', true)
    RETURNING id INTO v_queue_id;
  END IF;
  
  INSERT INTO mesaclik.queue_entries (
    queue_id, user_id, party_size, name, phone, email, status
  )
  VALUES (
    v_queue_id, p_user_id, p_party_size, 
    COALESCE(p_name, 'Visitante'), p_phone, p_email, 'waiting'
  )
  RETURNING * INTO v_entry;
  
  RETURN v_entry;
END;
$function$;

-- 2) expire_coupons (mesaclik) - void return
CREATE FUNCTION mesaclik.expire_coupons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik
AS $function$
BEGIN
  UPDATE mesaclik.coupons
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND expire_at < NOW();
END;
$function$;

-- 3) activate_scheduled_coupons (mesaclik) - void return
CREATE FUNCTION mesaclik.activate_scheduled_coupons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik
AS $function$
BEGIN
  UPDATE mesaclik.coupons
  SET status = 'active', updated_at = NOW()
  WHERE status = 'scheduled'
    AND start_at <= NOW()
    AND (expire_at IS NULL OR expire_at > NOW());
END;
$function$;

-- 4) cleanup_old_audit_logs (mesaclik)
CREATE FUNCTION mesaclik.cleanup_old_audit_logs(days_to_keep integer DEFAULT 90)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik
AS $function$
BEGIN
  DELETE FROM mesaclik.audit_log
  WHERE created_at < NOW() - (days_to_keep || ' days')::interval;
END;
$function$;

-- 5) cancel_reservation (mesaclik)
CREATE FUNCTION mesaclik.cancel_reservation(
  p_reservation_id uuid,
  p_user_id uuid,
  p_cancel_reason text DEFAULT NULL
)
RETURNS TABLE(id uuid, status mesaclik.reservation_status, canceled_at timestamptz, canceled_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
BEGIN
  RETURN QUERY
  UPDATE mesaclik.reservations r
  SET 
    status = 'canceled',
    canceled_at = NOW(),
    canceled_by = p_user_id::text,
    cancel_reason = COALESCE(p_cancel_reason, 'user_cancel'),
    updated_at = NOW()
  WHERE r.id = p_reservation_id
    AND (r.user_id = p_user_id OR EXISTS (
      SELECT 1 FROM mesaclik.restaurants rest 
      WHERE rest.id = r.restaurant_id AND rest.owner_id = p_user_id
    ))
  RETURNING r.id, r.status, r.canceled_at, r.canceled_by;
END;
$function$;

-- 6) update_updated_at (mesaclik)
CREATE OR REPLACE FUNCTION mesaclik.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 7) set_position_number (mesaclik)
CREATE OR REPLACE FUNCTION mesaclik.set_position_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik
AS $function$
DECLARE
  next_position integer;
BEGIN
  SELECT COALESCE(MAX(position_number), 0) + 1
  INTO next_position
  FROM mesaclik.queue_entries
  WHERE queue_id = NEW.queue_id
    AND DATE(created_at) = CURRENT_DATE;
  
  NEW.position_number := next_position;
  RETURN NEW;
END;
$function$;

-- 8) calculate_estimated_wait (mesaclik)
CREATE OR REPLACE FUNCTION mesaclik.calculate_estimated_wait()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
DECLARE
  v_restaurant_id uuid;
  v_avg_time integer;
  v_ahead integer;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id
  FROM mesaclik.queues WHERE id = NEW.queue_id;
  
  SELECT 
    CASE 
      WHEN NEW.party_size <= 2 THEN COALESCE(avg_wait_time_1_2, 30)
      WHEN NEW.party_size <= 4 THEN COALESCE(avg_wait_time_3_4, 45)
      WHEN NEW.party_size <= 6 THEN COALESCE(avg_wait_time_5_6, 60)
      ELSE COALESCE(avg_wait_time_7_8, 75)
    END INTO v_avg_time
  FROM mesaclik.queue_settings
  WHERE restaurant_id = v_restaurant_id;
  
  SELECT COUNT(*) INTO v_ahead
  FROM mesaclik.queue_entries
  WHERE queue_id = NEW.queue_id
    AND status = 'waiting'
    AND created_at < NEW.created_at;
  
  NEW.estimated_wait_time := COALESCE(v_avg_time, 30) * (v_ahead + 1) / 2;
  RETURN NEW;
END;
$function$;

-- 9) log_audit (mesaclik)
CREATE OR REPLACE FUNCTION mesaclik.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
DECLARE
  v_restaurant_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_restaurant_id := OLD.restaurant_id;
  ELSE
    v_restaurant_id := NEW.restaurant_id;
  END IF;
  
  INSERT INTO mesaclik.audit_log (
    restaurant_id, table_name, record_id, action, old_data, new_data, user_id
  )
  VALUES (
    v_restaurant_id,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid()
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- 10) update_system_insights_updated_at (public)
CREATE OR REPLACE FUNCTION public.update_system_insights_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ========================================
-- PARTE C: REMOVER POLÍTICAS ANÔNIMAS REDUNDANTES
-- ========================================
DROP POLICY IF EXISTS "Queue entries are viewable by everyone" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can view queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can insert queues" ON public.queues;
DROP POLICY IF EXISTS "Reservations are viewable by everyone" ON public.reservations;

-- ========================================
-- PARTE D: ÍNDICES PARA PERFORMANCE DE RLS
-- ========================================
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON public.restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_queue_id ON public.queue_entries(queue_id);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_id ON public.reservations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_queue_settings_restaurant_id ON public.queue_settings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reservation_settings_restaurant_id ON public.reservation_settings(restaurant_id);
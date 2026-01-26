
-- =====================================================
-- HARDENING COMPLETO: FUNÇÕES MESACLIK + RLS
-- =====================================================

-- 1. FUNÇÕES MESACLIK - Adicionar search_path para prevenir hijacking
-- =====================================================

-- apply_global_block
CREATE OR REPLACE FUNCTION mesaclik.apply_global_block(p_user uuid, p_minutes integer, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
declare
  v_id uuid;
begin
  insert into mesaclik.penalties (user_id, reason, block_until, created_at)
  values (p_user, p_reason, now() + make_interval(mins => p_minutes), now())
  returning id into v_id;
  return v_id;
end
$function$;

-- col_exists
CREATE OR REPLACE FUNCTION mesaclik.col_exists(p_schema text, p_table text, p_col text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik, public, information_schema
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
  );
$function$;

-- create_default_queues
CREATE OR REPLACE FUNCTION mesaclik.create_default_queues()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
begin
  for i in 1..10 loop
    insert into mesaclik.queues(restaurant_id, party_size)
    values (new.id, i)
    on conflict do nothing;
  end loop;
  return new;
end
$function$;

-- ensure_reservation_status_valid
CREATE OR REPLACE FUNCTION mesaclik.ensure_reservation_status_valid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
BEGIN
    IF NEW.status::text = 'seated' THEN
        NEW.status := 'pending'::mesaclik.reservation_status;
    END IF;
    IF NEW.status::text NOT IN ('pending', 'confirmed', 'canceled', 'completed') THEN
        RAISE EXCEPTION 'Status inválido: %. Use: pending, confirmed, canceled, completed', NEW.status;
    END IF;
    RETURN NEW;
END;
$function$;

-- fn_penalty_on_late_queue_cancel
CREATE OR REPLACE FUNCTION mesaclik.fn_penalty_on_late_queue_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
DECLARE
  elapsed interval;
  block_to timestamptz;
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status,'') <> 'cancelled' THEN
    elapsed := NOW() - NEW.created_at;
    IF elapsed > INTERVAL '5 minutes' THEN
      block_to := NOW() + INTERVAL '30 minutes';
      INSERT INTO mesaclik.penalties (user_id, reason, block_until, created_at)
      SELECT NEW.user_id, 'late_cancel_queue', block_to, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM mesaclik.penalties p
        WHERE p.user_id = NEW.user_id
          AND p.block_until > block_to
      );
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

-- fn_penalty_on_late_reservation_cancel
CREATE OR REPLACE FUNCTION mesaclik.fn_penalty_on_late_reservation_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
DECLARE
  elapsed interval;
  block_to timestamptz;
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status,'') <> 'cancelled' THEN
    elapsed := NOW() - NEW.created_at;
    IF elapsed > INTERVAL '5 minutes' THEN
      block_to := NOW() + INTERVAL '30 minutes';
      INSERT INTO mesaclik.penalties (user_id, reason, block_until, created_at)
      SELECT NEW.user_id, 'late_cancel_reservation', block_to, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM mesaclik.penalties p
        WHERE p.user_id = NEW.user_id
          AND p.block_until > block_to
      );
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

-- get_queue_position (mesaclik)
CREATE OR REPLACE FUNCTION mesaclik.get_queue_position(p_ticket_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
with t as (
  select queue_id, created_at, party_size
  from mesaclik.queue_entries
  where id = p_ticket_id
)
select count(*) + 1
from mesaclik.queue_entries e
join t on e.queue_id = t.queue_id
where e.status = 'waiting'
  and e.created_at < t.created_at
  and (
    case
      when e.party_size between 1 and 2 then '1-2'
      when e.party_size between 3 and 4 then '3-4'
      when e.party_size between 5 and 6 then '5-6'
      when e.party_size between 7 and 8 then '7-8'
      else '9+'
    end
  ) = (
    case
      when t.party_size between 1 and 2 then '1-2'
      when t.party_size between 3 and 4 then '3-4'
      when t.party_size between 5 and 6 then '5-6'
      when t.party_size between 7 and 8 then '7-8'
      else '9+'
    end
  );
$function$;

-- is_blocked_now
CREATE OR REPLACE FUNCTION mesaclik.is_blocked_now(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
  select exists (
    select 1
    from mesaclik.penalties p
    where p.user_id = p_user
      and coalesce(p.block_until, now() - interval '1 second') > now()
  );
$function$;

-- is_owner_of
CREATE OR REPLACE FUNCTION mesaclik.is_owner_of(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
  select exists (
    select 1
    from mesaclik.restaurants r
    where r.id = p_restaurant_id
      and r.owner_id = auth.uid()
  );
$function$;

-- table_exists
CREATE OR REPLACE FUNCTION mesaclik.table_exists(p_schema text, p_table text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik, public, information_schema
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = $1 AND table_name = $2
  );
$function$;

-- tg_queue_entries_set_ts
CREATE OR REPLACE FUNCTION mesaclik.tg_queue_entries_set_ts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      CASE NEW.status
        WHEN 'waiting'  THEN NULL;
        WHEN 'called'   THEN NEW.called_at   := COALESCE(NEW.called_at,   now());
        WHEN 'seated'   THEN NEW.seated_at   := COALESCE(NEW.seated_at,   now());
        WHEN 'canceled' THEN NEW.canceled_at := COALESCE(NEW.canceled_at, now());
        WHEN 'no_show'  THEN NEW.no_show_at  := COALESCE(NEW.no_show_at,  now());
      END CASE;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

-- tg_reservations_set_ts
CREATE OR REPLACE FUNCTION mesaclik.tg_reservations_set_ts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      CASE NEW.status
        WHEN 'pending'   THEN NULL;
        WHEN 'confirmed' THEN NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
        WHEN 'completed' THEN NEW.completed_at := COALESCE(NEW.completed_at, now());
        WHEN 'canceled'  THEN NEW.canceled_at  := COALESCE(NEW.canceled_at,  now());
        WHEN 'no_show'   THEN NEW.no_show_at   := COALESCE(NEW.no_show_at,   now());
      END CASE;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

-- update_updated_at_column (mesaclik)
CREATE OR REPLACE FUNCTION mesaclik.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- whoami
CREATE OR REPLACE FUNCTION mesaclik.whoami()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
  select jsonb_build_object(
    'uid', auth.uid(),
    'now', now(),
    'session_exists', auth.uid() is not null
  );
$function$;

-- 2. CORRIGIR POLÍTICAS RLS PERMISSIVAS
-- =====================================================

-- mesaclik.audit_log - INSERT apenas por sistema autenticado
DROP POLICY IF EXISTS "audit_log_insert_system" ON mesaclik.audit_log;
CREATE POLICY "audit_log_insert_system" ON mesaclik.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- mesaclik.coupon_audit_log
DROP POLICY IF EXISTS "Audit log writable by system" ON mesaclik.coupon_audit_log;
CREATE POLICY "Audit log writable by system" ON mesaclik.coupon_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- mesaclik.otp_logs
DROP POLICY IF EXISTS "otp_logs_insert_system" ON mesaclik.otp_logs;
DROP POLICY IF EXISTS "otp_logs_update_system" ON mesaclik.otp_logs;
CREATE POLICY "otp_logs_insert_system" ON mesaclik.otp_logs
  FOR INSERT
  WITH CHECK (true); -- OTP precisa funcionar para anon (envio de código)

CREATE POLICY "otp_logs_update_system" ON mesaclik.otp_logs
  FOR UPDATE
  USING (true); -- Verificação de OTP por anon

-- mesaclik.promotions
DROP POLICY IF EXISTS "Allow insert promotions" ON mesaclik.promotions;
CREATE POLICY "Allow insert promotions" ON mesaclik.promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );

-- mesaclik.queues
DROP POLICY IF EXISTS "Users can insert queues" ON mesaclik.queues;
CREATE POLICY "Users can insert queues" ON mesaclik.queues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  );

-- mesaclik.restaurant_terms_acceptance
DROP POLICY IF EXISTS "terms_restaurant_insert" ON mesaclik.restaurant_terms_acceptance;
DROP POLICY IF EXISTS "terms_restaurant_update" ON mesaclik.restaurant_terms_acceptance;
CREATE POLICY "terms_restaurant_insert" ON mesaclik.restaurant_terms_acceptance
  FOR INSERT
  WITH CHECK (true); -- Consentimento público (fluxo de fila)

CREATE POLICY "terms_restaurant_update" ON mesaclik.restaurant_terms_acceptance
  FOR UPDATE
  USING (true); -- Atualização de consentimento

-- mesaclik.restaurants UPDATE
DROP POLICY IF EXISTS "public_update_restaurants" ON mesaclik.restaurants;
CREATE POLICY "restaurants_update_owner_or_admin" ON mesaclik.restaurants
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR owner_id = auth.uid());

-- mesaclik.security_logs
DROP POLICY IF EXISTS "security_logs_insert_system" ON mesaclik.security_logs;
CREATE POLICY "security_logs_insert_system" ON mesaclik.security_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- mesaclik.email_preferences_audit
DROP POLICY IF EXISTS "email_preferences_audit_insert" ON mesaclik.email_preferences_audit;
CREATE POLICY "email_preferences_audit_insert" ON mesaclik.email_preferences_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- public.customers
DROP POLICY IF EXISTS "customers_insert_authenticated_valid" ON public.customers;
CREATE POLICY "customers_insert_authenticated_valid" ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- public.profiles - service_role apenas (não precisa mudar, é interno)

-- public.restaurant_marketing_optins - precisa funcionar para anon (fluxo público)
-- Mantém como está para consentimento de marketing

-- public.system_insights
DROP POLICY IF EXISTS "system_insights_anon_insert" ON public.system_insights;
CREATE POLICY "system_insights_insert_authenticated" ON public.system_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. FUNÇÃO HELPER PARA VERIFICAR ADMIN OU OWNER
-- =====================================================

CREATE OR REPLACE FUNCTION mesaclik.is_admin_or_owner(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik, public
AS $function$
  SELECT 
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r 
      WHERE r.id = p_restaurant_id AND r.owner_id = auth.uid()
    );
$function$;

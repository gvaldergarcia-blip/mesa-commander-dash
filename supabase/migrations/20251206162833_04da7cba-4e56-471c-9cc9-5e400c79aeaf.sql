
-- ========================================
-- MESACLIK SECURITY HARDENING - COMPLETO
-- ========================================

-- 1. CRIAR TIPO E TABELA DE USER ROLES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'owner', 'manager', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policies para user_roles
DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. FUNÇÃO SEGURA PARA VERIFICAR ROLES
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. POLICIES PARA TABELAS SEM POLICIES
-- 3.1 mesaclik.audit_log
DROP POLICY IF EXISTS "audit_log_read_authenticated" ON mesaclik.audit_log;
CREATE POLICY "audit_log_read_authenticated" ON mesaclik.audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "audit_log_insert_system" ON mesaclik.audit_log;
CREATE POLICY "audit_log_insert_system" ON mesaclik.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3.2 mesaclik.customers
DROP POLICY IF EXISTS "customers_read_owner" ON mesaclik.customers;
CREATE POLICY "customers_read_owner" ON mesaclik.customers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "customers_write_owner" ON mesaclik.customers;
CREATE POLICY "customers_write_owner" ON mesaclik.customers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.owner_id = auth.uid()));

-- 3.3 mesaclik.security_logs
DROP POLICY IF EXISTS "security_logs_read_own" ON mesaclik.security_logs;
CREATE POLICY "security_logs_read_own" ON mesaclik.security_logs
  FOR SELECT TO authenticated
  USING (actor = auth.uid());

DROP POLICY IF EXISTS "security_logs_insert_system" ON mesaclik.security_logs;
CREATE POLICY "security_logs_insert_system" ON mesaclik.security_logs
  FOR INSERT WITH CHECK (true);

-- 4. CORRIGIR FUNÇÕES COM search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION mesaclik.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, mesaclik
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION mesaclik.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, mesaclik
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION mesaclik.update_coupons_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, mesaclik
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION mesaclik.update_promocoes_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, mesaclik
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- 5. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON mesaclik.queue_entries(queue_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON mesaclik.reservations(restaurant_id, status, reservation_at);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON mesaclik.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON mesaclik.customers(email);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON mesaclik.audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_actor ON mesaclik.security_logs(actor, created_at);

-- 6. STORAGE POLICIES
INSERT INTO storage.buckets (id, name, public) VALUES ('restaurants', 'restaurants', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Restaurant owners can upload" ON storage.objects;
CREATE POLICY "Restaurant owners can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'restaurants' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Restaurant owners can delete" ON storage.objects;
CREATE POLICY "Restaurant owners can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'restaurants' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Public can read restaurant images" ON storage.objects;
CREATE POLICY "Public can read restaurant images" ON storage.objects
  FOR SELECT USING (bucket_id = 'restaurants');

-- 7. FUNÇÃO DE MÁSCARA LGPD
CREATE OR REPLACE FUNCTION mesaclik.mask_email(email text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public, mesaclik
AS $$
  SELECT CASE 
    WHEN email IS NULL THEN NULL
    WHEN LENGTH(email) < 5 THEN '***@***'
    ELSE CONCAT(LEFT(SPLIT_PART(email, '@', 1), 2), '***@', RIGHT(SPLIT_PART(email, '@', 2), 3))
  END
$$;

CREATE OR REPLACE FUNCTION mesaclik.mask_phone(phone text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public, mesaclik
AS $$
  SELECT CASE 
    WHEN phone IS NULL THEN NULL
    WHEN LENGTH(phone) < 6 THEN '***'
    ELSE CONCAT(LEFT(phone, 3), REPEAT('*', LENGTH(phone) - 5), RIGHT(phone, 2))
  END
$$;

-- 8. TRIGGER DE AUDITORIA
CREATE OR REPLACE FUNCTION mesaclik.log_table_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, mesaclik
AS $$
BEGIN
  INSERT INTO mesaclik.audit_log (id, user_id, action, table_name, record_id, old_data, new_data, created_at)
  VALUES (gen_random_uuid(), auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END, NOW());
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_reservations ON mesaclik.reservations;
CREATE TRIGGER audit_reservations AFTER INSERT OR UPDATE OR DELETE ON mesaclik.reservations
  FOR EACH ROW EXECUTE FUNCTION mesaclik.log_table_changes();

DROP TRIGGER IF EXISTS audit_queue_entries ON mesaclik.queue_entries;
CREATE TRIGGER audit_queue_entries AFTER INSERT OR UPDATE OR DELETE ON mesaclik.queue_entries
  FOR EACH ROW EXECUTE FUNCTION mesaclik.log_table_changes();

-- 9. PERMISSÕES SERVICE ROLE
GRANT USAGE ON SCHEMA mesaclik TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA mesaclik TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA mesaclik TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mesaclik TO service_role;

-- 10. REVOGAR PERMISSÕES DESNECESSÁRIAS
REVOKE ALL ON mesaclik.security_logs FROM anon;
REVOKE ALL ON mesaclik.audit_log FROM anon;

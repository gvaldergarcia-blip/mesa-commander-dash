-- ====================================
-- MESACLIK SECURITY HARDENING - VERSÃO CORRIGIDA
-- ====================================
-- Corrige issues críticos de segurança
-- Data: 2025-11-08
-- Versão: 1.2 (estrutura correta das tabelas)
-- ====================================

-- ==========================================
-- PARTE 1: HABILITAR RLS EM TABELAS SEM PROTEÇÃO
-- ==========================================

-- 1.1) mesaclik.customers 
-- Tabela não tem restaurant_id, parece ser global
-- Solução: RLS ativado SEM policies = apenas service_role acessa
ALTER TABLE mesaclik.customers ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Customers readable by restaurant owner" ON mesaclik.customers;
DROP POLICY IF EXISTS "Customers writable by restaurant owner" ON mesaclik.customers;

-- SEM POLICIES = apenas service_role pode acessar via edge functions


-- 1.2) mesaclik.promocoes (usa restaurante_id, não restaurant_id)
ALTER TABLE mesaclik.promocoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promocoes_owner_only ON mesaclik.promocoes;

CREATE POLICY promocoes_owner_only ON mesaclik.promocoes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = promocoes.restaurante_id
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = promocoes.restaurante_id
    AND r.owner_id = auth.uid()
  )
);


-- 1.3) mesaclik.security_logs 
-- Logs de auditoria não devem ser acessíveis via client
ALTER TABLE mesaclik.security_logs ENABLE ROW LEVEL SECURITY;

-- SEM POLICIES = apenas service_role pode acessar


-- ==========================================
-- PARTE 2: CORRIGIR FUNÇÕES SEM SEARCH_PATH
-- ==========================================

-- Corrigir funções security definer adicionando search_path

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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

CREATE OR REPLACE FUNCTION public.update_email_logs_updated_at()
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

CREATE OR REPLACE FUNCTION public.set_owner_and_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF new.owner_id IS NULL THEN
      new.owner_id := auth.uid();
    END IF;
    new.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    new.updated_at := now();
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_reservation_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO UPDATE SET email = excluded.email;
  RETURN new;
END;
$function$;


-- ==========================================
-- PARTE 3: LIMPAR POLICIES DUPLICADAS
-- ==========================================

-- Remover policies "viewable by everyone" que expõem dados públicos
DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write_own" ON public.profiles;
DROP POLICY IF EXISTS "Queue entries are viewable by everyone" ON public.queue_entries;
DROP POLICY IF EXISTS "Users can view queue entries" ON public.queue_entries;
DROP POLICY IF EXISTS "Reservations are viewable by everyone" ON public.reservations;
DROP POLICY IF EXISTS "Queues are viewable by everyone" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues" ON public.queues;


-- ==========================================
-- PARTE 4: CONSOLIDAR STORAGE POLICIES
-- ==========================================

-- Remover policies duplicadas no storage
DROP POLICY IF EXISTS "Allow delete from restaurants bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert to restaurants bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update to restaurants bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to restaurants bucket" ON storage.objects;
DROP POLICY IF EXISTS storage_restaurants_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS storage_restaurants_owner_update ON storage.objects;
DROP POLICY IF EXISTS storage_restaurants_owner_delete ON storage.objects;

-- Criar policies consolidadas para storage
CREATE POLICY storage_restaurants_authenticated_insert ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'restaurants'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY storage_restaurants_owner_update ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'restaurants'
  AND EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.owner_id = auth.uid()
    AND (storage.foldername(name))[1]::uuid = r.id
  )
);

CREATE POLICY storage_restaurants_owner_delete ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'restaurants'
  AND EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.owner_id = auth.uid()
    AND (storage.foldername(name))[1]::uuid = r.id
  )
);


-- ==========================================
-- PARTE 5: HELPER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_restaurant_member(
  p_restaurant_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
  SELECT EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = p_restaurant_id
    AND r.owner_id = p_user_id
  );
$$;


-- ==========================================
-- PARTE 6: AUDIT LOG (public schema)
-- ==========================================

ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON TABLE mesaclik.security_logs IS 'Security audit logs - acesso apenas via service_role';
COMMENT ON TABLE mesaclik.customers IS 'Customer data - RLS habilitado, acesso apenas via service_role/edge functions';
COMMENT ON TABLE mesaclik.promocoes IS 'Promotions legacy - RLS habilitado, acesso apenas restaurant owners';
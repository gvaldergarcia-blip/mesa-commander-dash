-- Permitir que o service_role do Supabase Auth acesse a tabela profiles
-- Isso é necessário para magic links, signup e outras operações de auth

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "service_role_can_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "service_role_can_insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "service_role_can_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "service_role_can_delete_profiles" ON public.profiles;

-- Permitir que o service_role leia profiles
CREATE POLICY "service_role_can_read_profiles"
ON public.profiles
FOR SELECT
TO service_role
USING (true);

-- Permitir que o service_role insira profiles
CREATE POLICY "service_role_can_insert_profiles"
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- Permitir que o service_role atualize profiles
CREATE POLICY "service_role_can_update_profiles"
ON public.profiles
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Permitir que o service_role delete profiles (para limpeza)
CREATE POLICY "service_role_can_delete_profiles"
ON public.profiles
FOR DELETE
TO service_role
USING (true);
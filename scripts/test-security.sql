-- ========================================
-- MESACLIK - TESTES DE SEGURANÇA (RLS)
-- ========================================
-- Script para validar Row Level Security
-- Execute via Supabase SQL Editor ou psql
-- ========================================

-- ==========================================
-- SETUP: CRIAR USUÁRIOS DE TESTE
-- ==========================================
-- NOTA: Execute isso APENAS em ambiente de staging/dev
-- NUNCA em produção com dados reais

DO $$
DECLARE
  user_a_id UUID := gen_random_uuid();
  user_b_id UUID := gen_random_uuid();
  restaurant_a_id UUID;
  restaurant_b_id UUID;
BEGIN
  -- Criar 2 restaurantes de teste
  INSERT INTO mesaclik.restaurants (id, name, cuisine, owner_id)
  VALUES 
    (gen_random_uuid(), 'Test Restaurant A', 'italian', user_a_id),
    (gen_random_uuid(), 'Test Restaurant B', 'brazilian', user_b_id)
  RETURNING id INTO restaurant_a_id, restaurant_b_id;

  RAISE NOTICE 'Created test restaurants: A=% B=%', restaurant_a_id, restaurant_b_id;
  RAISE NOTICE 'User A: %', user_a_id;
  RAISE NOTICE 'User B: %', user_b_id;
END $$;


-- ==========================================
-- TESTE 1: RLS em todas as tabelas
-- ==========================================
-- Verifica se TODAS as tabelas têm RLS habilitado

SELECT 
  schemaname, 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as status
FROM pg_tables
WHERE schemaname IN ('public', 'mesaclik')
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT IN ('spatial_ref_sys') -- PostGIS table
ORDER BY 
  schemaname, 
  CASE WHEN NOT rowsecurity THEN 0 ELSE 1 END, -- RLS disabled first
  tablename;

-- ❌ Se alguma linha mostrar "RLS DISABLED", é um problema crítico!


-- ==========================================
-- TESTE 2: Funções sem search_path
-- ==========================================
-- Lista funções SECURITY DEFINER sem search_path definido

SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '✅ HAS search_path'
    ELSE '❌ MISSING search_path'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'mesaclik')
  AND prosecdef = true -- SECURITY DEFINER
  AND NOT pg_get_functiondef(p.oid) LIKE '%SET search_path%'
ORDER BY n.nspname, p.proname;

-- ❌ Qualquer função listada precisa ser corrigida!


-- ==========================================
-- TESTE 3: Views SECURITY DEFINER
-- ==========================================
-- Lista views que bypassam RLS

SELECT 
  schemaname,
  viewname,
  CASE 
    WHEN definition LIKE '%SECURITY DEFINER%' THEN '❌ SECURITY DEFINER VIEW'
    ELSE '✅ NORMAL VIEW'
  END as status
FROM pg_views
WHERE schemaname IN ('public', 'mesaclik')
  AND definition LIKE '%SECURITY DEFINER%'
ORDER BY schemaname, viewname;

-- ❌ Idealmente, não deveria haver nenhuma view SECURITY DEFINER


-- ==========================================
-- TESTE 4: Tabelas com policies
-- ==========================================
-- Verifica quantas policies cada tabela tem

SELECT 
  schemaname,
  tablename,
  count(*) as policy_count,
  string_agg(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname IN ('public', 'mesaclik')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

-- ℹ️ Tabelas sem policies dependem de service_role apenas


-- ==========================================
-- TESTE 5: Storage policies
-- ==========================================
-- Verifica policies no storage.objects

SELECT 
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN 'public' = ANY(roles) OR 'anon' = ANY(roles) THEN '⚠️ PUBLIC ACCESS'
    ELSE '✅ RESTRICTED'
  END as access_level
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY 
  CASE WHEN 'public' = ANY(roles) THEN 0 ELSE 1 END,
  cmd;

-- ⚠️ Verifique se acesso público é intencional


-- ==========================================
-- TESTE 6: Policies com acesso anônimo
-- ==========================================
-- Lista todas as policies que permitem acesso não autenticado

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  roles,
  '⚠️ ALLOWS ANONYMOUS' as warning
FROM pg_policies
WHERE schemaname IN ('public', 'mesaclik')
  AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
ORDER BY schemaname, tablename;

-- ⚠️ Revisar se acesso anônimo é necessário para cada tabela


-- ==========================================
-- TESTE 7: Simulação de acesso de usuário
-- ==========================================
-- Testa se usuário A consegue acessar dados do usuário B

-- NOTA: Este teste funciona apenas se você:
-- 1. Executar via supabase CLI com set role
-- 2. Ou criar uma edge function que faz o teste
-- 3. Ou usar Supabase Dashboard > SQL Editor com session context

-- Exemplo conceitual (não executável diretamente aqui):
/*
-- Login como User A
SET ROLE authenticated;
SET request.jwt.claim.sub = '<USER_A_UUID>';

-- Tentar acessar dados do User B
SELECT * FROM mesaclik.queue_entries WHERE user_id = '<USER_B_UUID>';
-- ✅ Esperado: 0 rows (acesso negado)

-- Acessar próprios dados
SELECT * FROM mesaclik.queue_entries WHERE user_id = '<USER_A_UUID>';
-- ✅ Esperado: retorna dados do User A
*/


-- ==========================================
-- TESTE 8: Verificar secrets configurados
-- ==========================================
-- Lista todos os secrets (nomes apenas, sem valores)

SELECT 
  name,
  created_at
FROM vault.secrets
ORDER BY name;

-- ✅ Esperado: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, SUPABASE_SERVICE_ROLE_KEY


-- ==========================================
-- LIMPEZA: Remover dados de teste
-- ==========================================
-- Execute para limpar dados de teste criados

/*
DELETE FROM mesaclik.restaurants WHERE name LIKE 'Test Restaurant%';
*/


-- ==========================================
-- RESUMO DO QUE VERIFICAR
-- ==========================================
-- ✅ TESTE 1: Todas as tabelas devem ter RLS habilitado
-- ✅ TESTE 2: Nenhuma função SECURITY DEFINER sem search_path
-- ✅ TESTE 3: Idealmente, nenhuma view SECURITY DEFINER
-- ✅ TESTE 4: Tabelas sensíveis devem ter policies (ou serem service_role only)
-- ✅ TESTE 5: Storage policies devem ser restritivas
-- ⚠️ TESTE 6: Acesso anônimo deve ser intencional
-- ✅ TESTE 7: Usuários não devem acessar dados de outros usuários
-- ✅ TESTE 8: Secrets devem estar configurados

-- ==========================================
-- COMO EXECUTAR
-- ==========================================
-- Via Supabase Dashboard:
-- 1. Vá em SQL Editor
-- 2. Cole este script
-- 3. Execute seção por seção (não tudo de uma vez)
-- 4. Revise os resultados de cada teste
--
-- Via CLI:
-- psql $DATABASE_URL -f scripts/test-security.sql
--
-- ==========================================

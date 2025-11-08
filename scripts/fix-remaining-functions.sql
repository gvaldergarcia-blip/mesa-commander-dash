-- ========================================
-- MESACLIK - CORRIGIR FUNÇÕES SEM SEARCH_PATH
-- ========================================
-- Este script adiciona search_path às funções restantes
-- Execute após revisar cada função individualmente
-- ========================================

-- ==========================================
-- PARTE 1: IDENTIFICAR FUNÇÕES SEM SEARCH_PATH
-- ==========================================

-- Execute primeiro para ver quais funções precisam ser corrigidas:
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END as volatility,
  CASE 
    WHEN prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'mesaclik')
  AND prosecdef = true -- apenas SECURITY DEFINER
  AND NOT pg_get_functiondef(p.oid) LIKE '%SET search_path%'
ORDER BY n.nspname, p.proname;


-- ==========================================
-- PARTE 2: TEMPLATE PARA CORRIGIR FUNÇÕES
-- ==========================================

-- Para cada função identificada acima, use este template:

/*
CREATE OR REPLACE FUNCTION {schema}.{function_name}({arguments})
RETURNS {return_type}
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik  -- ← ADICIONE ESTA LINHA
AS $function$
BEGIN
  -- ... código da função ...
END;
$function$;
*/


-- ==========================================
-- PARTE 3: FUNÇÕES COMUNS A CORRIGIR
-- ==========================================

-- 3.1) cancel_reservation (se ainda não tiver search_path)
CREATE OR REPLACE FUNCTION public.cancel_reservation(
  reservation_id uuid, 
  canceled_by_param text DEFAULT 'user'::text, 
  cancel_reason_param text DEFAULT 'user_cancel'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
DECLARE
    result JSON;
    updated_reservation mesaclik.reservations%ROWTYPE;
BEGIN
    UPDATE mesaclik.reservations 
    SET 
        status = 'canceled'::mesaclik.reservation_status,
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
$function$;


-- 3.2) update_queue_entry_status
CREATE OR REPLACE FUNCTION public.update_queue_entry_status(
  p_entry_id uuid, 
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
DECLARE
  v_status mesaclik.queue_status;
BEGIN
  v_status := p_status::mesaclik.queue_status;
  
  UPDATE mesaclik.queue_entries
  SET 
    status = v_status,
    updated_at = NOW(),
    called_at = CASE WHEN v_status = 'called' THEN NOW() ELSE called_at END,
    seated_at = CASE WHEN v_status = 'seated' THEN NOW() ELSE seated_at END,
    canceled_at = CASE WHEN v_status IN ('canceled', 'no_show') THEN NOW() ELSE canceled_at END
  WHERE id = p_entry_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrada da fila não encontrada';
  END IF;
END;
$function$;


-- 3.3) get_queue_position
CREATE OR REPLACE FUNCTION public.get_queue_position(p_ticket_id uuid)
RETURNS integer
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
  WITH t AS (
    SELECT id, queue_id, party_size, created_at
    FROM mesaclik.queue_entries
    WHERE id = p_ticket_id
    LIMIT 1
  )
  SELECT
    COUNT(*) + 1 AS position
  FROM mesaclik.queue_entries e
  JOIN t ON e.queue_id = t.queue_id
  WHERE e.status = 'waiting'
    AND e.created_at < t.created_at
    AND (
      CASE
        WHEN e.party_size BETWEEN 1 AND 2 THEN '1-2'
        WHEN e.party_size BETWEEN 3 AND 4 THEN '3-4'
        WHEN e.party_size BETWEEN 5 AND 6 THEN '5-6'
        WHEN e.party_size BETWEEN 7 AND 8 THEN '7-8'
        ELSE '9+'
      END
    ) = (
      CASE
        WHEN t.party_size BETWEEN 1 AND 2 THEN '1-2'
        WHEN t.party_size BETWEEN 3 AND 4 THEN '3-4'
        WHEN t.party_size BETWEEN 5 AND 6 THEN '5-6'
        WHEN t.party_size BETWEEN 7 AND 8 THEN '7-8'
        ELSE '9+'
      END
    );
$function$;


-- 3.4) cancel_queue_entry (versão com p_reason, p_ticket_id, p_user_id)
CREATE OR REPLACE FUNCTION public.cancel_queue_entry(
  p_reason text, 
  p_ticket_id uuid, 
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
DECLARE
  v_id uuid;
BEGIN
  UPDATE mesaclik.queue_entries qe
  SET 
    status = 'cancelled',
    cancelled_by = 'user',
    cancel_reason = p_reason,
    cancelled_at = NOW()
  WHERE qe.id = p_ticket_id
    AND qe.user_id = p_user_id
    AND qe.status = 'waiting'
  RETURNING qe.id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No waiting ticket found for given ticket/user'
      USING errcode = 'P0001';
  END IF;

  RETURN v_id;
END;
$function$;


-- 3.5) enter_queue
CREATE OR REPLACE FUNCTION public.enter_queue(
  p_party_size integer, 
  p_restaurant_id uuid
)
RETURNS mesaclik.queue_entries
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $function$
  SELECT mesaclik.enter_queue(
    p_restaurant_id,
    auth.uid(),
    p_party_size,
    'Visitante',
    NULL,
    NULL
  );
$function$;


-- ==========================================
-- PARTE 4: VERIFICAR SE CORRIGIU
-- ==========================================

-- Execute novamente para verificar se ainda há funções sem search_path:
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  '❌ STILL MISSING search_path' as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'mesaclik')
  AND prosecdef = true
  AND NOT pg_get_functiondef(p.oid) LIKE '%SET search_path%'
ORDER BY n.nspname, p.proname;

-- ✅ Se retornar 0 rows, todas as funções SECURITY DEFINER estão protegidas!


-- ==========================================
-- OBSERVAÇÕES
-- ==========================================
-- 1. Sempre adicione search_path em funções SECURITY DEFINER
-- 2. Use `public, mesaclik` se a função acessa ambos os schemas
-- 3. Use apenas `public` se a função só acessa tabelas do public
-- 4. Teste cada função após modificar para garantir que ainda funciona
-- 5. Rode o linter do Supabase após aplicar as correções:
--    https://supabase.com/dashboard/project/akqldesakmcroydbgkbe/database/linter
-- ==========================================

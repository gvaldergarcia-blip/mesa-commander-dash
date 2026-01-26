-- ========================================
-- FASE 3: CORRIGIR FUNÇÕES SEM SEARCH_PATH (PARTE 2)
-- ========================================
-- Drop e recria enter_queue com search_path correto

-- 5) enter_queue - precisa DROP primeiro por causa do tipo de retorno
DROP FUNCTION IF EXISTS public.enter_queue(integer, uuid);

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
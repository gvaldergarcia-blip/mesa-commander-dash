-- FASE 2: Adicionar campo wait_time_min e atualizar função de status

-- 1. Adicionar coluna wait_time_min na tabela queue_entries
ALTER TABLE mesaclik.queue_entries 
ADD COLUMN IF NOT EXISTS wait_time_min INTEGER;

COMMENT ON COLUMN mesaclik.queue_entries.wait_time_min IS 'Tempo de espera em minutos (calculado quando status = seated)';

-- 2. Atualizar função update_queue_entry_status para calcular wait_time_min
CREATE OR REPLACE FUNCTION public.update_queue_entry_status(p_entry_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $function$
DECLARE
  v_status mesaclik.queue_status;
  v_created_at timestamptz;
  v_wait_time_min integer;
BEGIN
  -- Cast do status para o enum correto
  v_status := p_status::mesaclik.queue_status;
  
  -- Se status for 'seated', calcular wait_time_min
  IF v_status = 'seated' THEN
    SELECT created_at INTO v_created_at
    FROM mesaclik.queue_entries
    WHERE id = p_entry_id;
    
    -- Calcular diferença em minutos
    v_wait_time_min := ROUND(EXTRACT(EPOCH FROM (NOW() - v_created_at)) / 60)::integer;
  END IF;
  
  -- Atualizar a entrada na tabela mesaclik.queue_entries
  UPDATE mesaclik.queue_entries
  SET 
    status = v_status,
    updated_at = NOW(),
    called_at = CASE WHEN v_status = 'called' THEN NOW() ELSE called_at END,
    seated_at = CASE WHEN v_status = 'seated' THEN NOW() ELSE seated_at END,
    canceled_at = CASE WHEN v_status IN ('canceled', 'no_show') THEN NOW() ELSE canceled_at END,
    wait_time_min = CASE WHEN v_status = 'seated' THEN v_wait_time_min ELSE wait_time_min END
  WHERE id = p_entry_id;
  
  -- Verificar se a entrada foi encontrada
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrada da fila não encontrada';
  END IF;
END;
$function$;

-- 3. Criar função para buscar tempos médios por faixa de tamanho
CREATE OR REPLACE FUNCTION mesaclik.get_queue_wait_time_averages(p_restaurant_id uuid)
RETURNS TABLE (
  size_range text,
  avg_wait_time_min integer,
  sample_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'mesaclik'
AS $function$
  WITH recent_entries AS (
    SELECT 
      qe.party_size,
      qe.wait_time_min,
      CASE 
        WHEN qe.party_size BETWEEN 1 AND 2 THEN '1-2'
        WHEN qe.party_size BETWEEN 3 AND 4 THEN '3-4'
        WHEN qe.party_size BETWEEN 5 AND 6 THEN '5-6'
        ELSE '7+'
      END as size_range
    FROM mesaclik.queue_entries qe
    JOIN mesaclik.queues q ON qe.queue_id = q.id
    WHERE q.restaurant_id = p_restaurant_id
      AND qe.status = 'seated'
      AND qe.wait_time_min IS NOT NULL
      AND qe.created_at >= NOW() - INTERVAL '30 days'
  )
  SELECT 
    size_range,
    ROUND(AVG(wait_time_min))::integer as avg_wait_time_min,
    COUNT(*) as sample_count
  FROM recent_entries
  GROUP BY size_range
  ORDER BY size_range;
$function$;
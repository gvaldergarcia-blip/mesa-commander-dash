-- Drop existing function and recreate with correct schema references
DROP FUNCTION IF EXISTS public.clear_queue(uuid);

CREATE OR REPLACE FUNCTION public.clear_queue(p_restaurant_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entries_affected integer;
BEGIN
  -- Update all waiting/called entries to 'cleared' status in mesaclik schema
  UPDATE mesaclik.queue_entries qe
  SET 
    status = 'cleared',
    canceled_at = now(),
    updated_at = now()
  FROM mesaclik.queues q
  WHERE qe.queue_id = q.id
    AND q.restaurant_id = p_restaurant_id
    AND qe.status IN ('waiting', 'called');
  
  GET DIAGNOSTICS v_entries_affected = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'entries_affected', v_entries_affected,
    'message', format('%s entradas removidas da fila', v_entries_affected)
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
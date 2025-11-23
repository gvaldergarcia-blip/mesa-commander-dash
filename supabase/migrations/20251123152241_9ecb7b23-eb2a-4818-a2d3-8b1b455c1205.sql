-- Corrigir função update_queue_entry_status para usar schema mesaclik
DROP FUNCTION IF EXISTS public.update_queue_entry_status(uuid, text);

CREATE OR REPLACE FUNCTION public.update_queue_entry_status(p_entry_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, mesaclik
AS $$
DECLARE
  v_status mesaclik.queue_status;
BEGIN
  -- Cast do status para o enum correto
  v_status := p_status::mesaclik.queue_status;
  
  -- Atualizar a entrada na tabela mesaclik.queue_entries
  UPDATE mesaclik.queue_entries
  SET 
    status = v_status,
    updated_at = NOW(),
    called_at = CASE WHEN v_status = 'called' THEN NOW() ELSE called_at END,
    seated_at = CASE WHEN v_status = 'seated' THEN NOW() ELSE seated_at END,
    canceled_at = CASE WHEN v_status IN ('canceled', 'no_show') THEN NOW() ELSE canceled_at END
  WHERE id = p_entry_id;
  
  -- Verificar se a entrada foi encontrada
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrada da fila não encontrada';
  END IF;
END;
$$;
-- Criar função para atualizar status de entrada na fila com cast correto
CREATE OR REPLACE FUNCTION public.update_queue_entry_status(
  p_entry_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status mesaclik.queue_status;
BEGIN
  -- Cast do status para o enum correto
  v_status := p_status::mesaclik.queue_status;
  
  -- Preparar dados de atualização
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
$$;
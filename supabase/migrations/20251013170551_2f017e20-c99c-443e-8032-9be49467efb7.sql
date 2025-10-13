-- Remover constraints antigas que impedem 'seated' e 'no_show'
ALTER TABLE mesaclik.queue_entries 
  DROP CONSTRAINT IF EXISTS queue_entries_status_check;

ALTER TABLE mesaclik.queue_entries 
  DROP CONSTRAINT IF EXISTS queue_entries_status_chk;

-- Adicionar constraint que permite todos os valores válidos do enum
ALTER TABLE mesaclik.queue_entries 
  ADD CONSTRAINT queue_entries_status_valid 
  CHECK (status IN ('waiting', 'called', 'seated', 'canceled', 'no_show', 'served'));
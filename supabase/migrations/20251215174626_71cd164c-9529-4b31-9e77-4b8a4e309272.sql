-- Alinhar cálculo de posição com a Tela Comando (ordem global por created_at, desempate por id)
-- Substitui a função gerada pelo Cursor que calculava posição por party_size.

CREATE OR REPLACE FUNCTION mesaclik.get_queue_position_by_party_size(
  p_entry_id uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = mesaclik, public
AS $$
  WITH t AS (
    SELECT id, queue_id
    FROM mesaclik.queue_entries
    WHERE id = p_entry_id
      AND status = 'waiting'
    LIMIT 1
  ),
  ordered_entries AS (
    SELECT e.id,
           ROW_NUMBER() OVER (ORDER BY e.created_at ASC, e.id ASC) AS position
    FROM mesaclik.queue_entries e
    JOIN t ON e.queue_id = t.queue_id
    WHERE e.status = 'waiting'
  )
  SELECT position
  FROM ordered_entries
  WHERE id = p_entry_id;
$$;
-- Permitir status 'cleared' na constraint de validação de status da fila
-- Atualmente o enum mesaclik.queue_status já contém 'cleared', mas a constraint não.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'mesaclik'
      AND t.relname = 'queue_entries'
      AND c.conname = 'queue_entries_status_valid'
  ) THEN
    ALTER TABLE mesaclik.queue_entries
      DROP CONSTRAINT queue_entries_status_valid;
  END IF;
END $$;

ALTER TABLE mesaclik.queue_entries
  ADD CONSTRAINT queue_entries_status_valid
  CHECK (
    status = ANY (
      ARRAY[
        'waiting'::mesaclik.queue_status,
        'called'::mesaclik.queue_status,
        'seated'::mesaclik.queue_status,
        'canceled'::mesaclik.queue_status,
        'no_show'::mesaclik.queue_status,
        'served'::mesaclik.queue_status,
        'cleared'::mesaclik.queue_status
      ]
    )
  );

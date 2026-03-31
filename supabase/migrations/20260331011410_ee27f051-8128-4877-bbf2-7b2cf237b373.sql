-- Permitir múltiplas filas por restaurante, diferenciadas por tipo
ALTER TABLE mesaclik.queues DROP CONSTRAINT IF EXISTS queues_restaurant_id_unique;

-- Garantir unicidade por restaurante + tipo de fila
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'mesaclik'
      AND t.relname = 'queues'
      AND c.conname = 'queues_restaurant_id_queue_type_key'
  ) THEN
    ALTER TABLE mesaclik.queues
    ADD CONSTRAINT queues_restaurant_id_queue_type_key UNIQUE (restaurant_id, queue_type);
  END IF;
END $$;
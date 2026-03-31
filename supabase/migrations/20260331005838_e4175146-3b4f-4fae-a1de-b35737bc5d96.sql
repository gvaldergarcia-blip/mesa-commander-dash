
-- Add queue_type column to mesaclik.queues
ALTER TABLE mesaclik.queues ADD COLUMN IF NOT EXISTS queue_type TEXT NOT NULL DEFAULT 'normal';

-- Add exclusive queue settings to mesaclik.queue_settings
ALTER TABLE mesaclik.queue_settings ADD COLUMN IF NOT EXISTS has_exclusive_queue BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mesaclik.queue_settings ADD COLUMN IF NOT EXISTS exclusive_queue_name TEXT NOT NULL DEFAULT 'Fila Exclusiva';

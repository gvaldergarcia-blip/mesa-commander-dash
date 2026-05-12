ALTER TABLE public.checklist_items
ADD COLUMN IF NOT EXISTS daily_frequency INTEGER NOT NULL DEFAULT 1
CHECK (daily_frequency >= 1 AND daily_frequency <= 24);
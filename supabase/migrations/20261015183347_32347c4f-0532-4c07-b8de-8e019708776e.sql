ALTER TABLE public.label_receipt_drafts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'photo';
ALTER TABLE public.label_receipt_drafts ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.label_receipt_drafts DROP CONSTRAINT IF EXISTS label_receipt_drafts_restaurant_id_key;
DROP INDEX IF EXISTS public.label_receipt_drafts_restaurant_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS label_receipt_drafts_restaurant_kind_key ON public.label_receipt_drafts (restaurant_id, kind);
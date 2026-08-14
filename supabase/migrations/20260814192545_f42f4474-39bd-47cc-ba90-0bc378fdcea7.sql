ALTER TABLE public.label_receipts
  ADD COLUMN IF NOT EXISTS temperature_c numeric,
  ADD COLUMN IF NOT EXISTS computed_at timestamptz;

ALTER TABLE public.label_receipt_items
  ADD COLUMN IF NOT EXISTS original_expiry_date date;
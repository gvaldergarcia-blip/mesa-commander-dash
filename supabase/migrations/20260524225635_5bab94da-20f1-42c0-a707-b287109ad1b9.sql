
ALTER TABLE public.label_products
  ADD COLUMN IF NOT EXISTS allergens text,
  ADD COLUMN IF NOT EXISTS ingredients text;

ALTER TABLE public.label_issuances
  ADD COLUMN IF NOT EXISTS cif text,
  ADD COLUMN IF NOT EXISTS allergens text,
  ADD COLUMN IF NOT EXISTS ingredients text;

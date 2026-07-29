ALTER TABLE public.label_products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS default_weight text,
  ADD COLUMN IF NOT EXISTS default_employee_id uuid;
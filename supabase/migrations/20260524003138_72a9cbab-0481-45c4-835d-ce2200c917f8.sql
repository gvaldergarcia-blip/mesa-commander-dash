ALTER TABLE public.label_products
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS cif TEXT;

CREATE INDEX IF NOT EXISTS idx_label_products_category ON public.label_products(restaurant_id, category);
ALTER TABLE public.label_products
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS production_validity_value integer,
  ADD COLUMN IF NOT EXISTS production_validity_unit text,
  ADD COLUMN IF NOT EXISTS pop_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'label_products_origin_check'
  ) THEN
    ALTER TABLE public.label_products
      ADD CONSTRAINT label_products_origin_check CHECK (origin IN ('received','produced'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'label_products_production_validity_unit_check'
  ) THEN
    ALTER TABLE public.label_products
      ADD CONSTRAINT label_products_production_validity_unit_check
      CHECK (production_validity_unit IS NULL OR production_validity_unit IN ('hours','days','months'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_label_products_origin ON public.label_products (restaurant_id, origin);
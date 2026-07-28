ALTER TABLE public.label_products
  DROP CONSTRAINT IF EXISTS label_products_manipulation_validity_unit_check;

ALTER TABLE public.label_products
  ADD CONSTRAINT label_products_manipulation_validity_unit_check
  CHECK (manipulation_validity_unit IS NULL OR manipulation_validity_unit IN ('hours','days','months'));
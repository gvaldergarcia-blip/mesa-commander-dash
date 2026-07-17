
ALTER TABLE public.product_stock_status
  ADD COLUMN IF NOT EXISTS weight_grams numeric,
  ADD COLUMN IF NOT EXISTS sector text;

ALTER TABLE public.stock_check_logs
  ADD COLUMN IF NOT EXISTS weight_grams numeric,
  ADD COLUMN IF NOT EXISTS sector text;

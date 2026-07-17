ALTER TABLE public.product_stock_status DROP CONSTRAINT IF EXISTS product_stock_status_status_check;
ALTER TABLE public.product_stock_status ADD CONSTRAINT product_stock_status_status_check CHECK (status IN ('ok','atencao','falta'));
ALTER TABLE public.stock_check_logs DROP CONSTRAINT IF EXISTS stock_check_logs_status_check;
ALTER TABLE public.stock_check_logs ADD CONSTRAINT stock_check_logs_status_check CHECK (status IN ('ok','atencao','falta'));

CREATE TABLE IF NOT EXISTS public.product_stock_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.label_products(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','falta')),
  marked_by_employee_id UUID REFERENCES public.label_employees(id) ON DELETE SET NULL,
  marked_by_name TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_status_restaurant ON public.product_stock_status(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_stock_status_falta ON public.product_stock_status(restaurant_id, status) WHERE status = 'falta';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock_status TO authenticated;
GRANT SELECT ON public.product_stock_status TO anon;
GRANT ALL ON public.product_stock_status TO service_role;

ALTER TABLE public.product_stock_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_status_read" ON public.product_stock_status
  FOR SELECT USING (is_member_or_admin(restaurant_id));
CREATE POLICY "stock_status_insert" ON public.product_stock_status
  FOR INSERT WITH CHECK (is_member_or_admin(restaurant_id));
CREATE POLICY "stock_status_update" ON public.product_stock_status
  FOR UPDATE USING (is_member_or_admin(restaurant_id));
CREATE POLICY "stock_status_delete" ON public.product_stock_status
  FOR DELETE USING (is_member_or_admin(restaurant_id));

CREATE TRIGGER update_stock_status_updated_at
  BEFORE UPDATE ON public.product_stock_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log opcional pra histórico (auditoria simples)
CREATE TABLE IF NOT EXISTS public.stock_check_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  status TEXT NOT NULL,
  marked_by_employee_id UUID,
  marked_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_logs_restaurant_date ON public.stock_check_logs(restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.stock_check_logs TO authenticated;
GRANT ALL ON public.stock_check_logs TO service_role;

ALTER TABLE public.stock_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_logs_read" ON public.stock_check_logs
  FOR SELECT USING (is_member_or_admin(restaurant_id));
CREATE POLICY "stock_logs_insert" ON public.stock_check_logs
  FOR INSERT WITH CHECK (is_member_or_admin(restaurant_id));

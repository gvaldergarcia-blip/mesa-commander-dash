CREATE TABLE public.label_issuances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  label_product_id UUID REFERENCES public.label_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  manufacture_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date TIMESTAMPTZ NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  batch TEXT,
  responsible TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','discarded')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_label_issuances_restaurant ON public.label_issuances(restaurant_id);
CREATE INDEX idx_label_issuances_status_expiry ON public.label_issuances(restaurant_id, status, expiry_date);

ALTER TABLE public.label_issuances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "label_issuances_tenant_select"
ON public.label_issuances FOR SELECT
TO authenticated
USING (is_member_or_admin(restaurant_id));

CREATE POLICY "label_issuances_tenant_insert"
ON public.label_issuances FOR INSERT
TO authenticated
WITH CHECK (is_member_or_admin(restaurant_id));

CREATE POLICY "label_issuances_tenant_update"
ON public.label_issuances FOR UPDATE
TO authenticated
USING (is_member_or_admin(restaurant_id));

CREATE POLICY "label_issuances_tenant_delete"
ON public.label_issuances FOR DELETE
TO authenticated
USING (is_member_or_admin(restaurant_id));

CREATE TRIGGER update_label_issuances_updated_at
BEFORE UPDATE ON public.label_issuances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
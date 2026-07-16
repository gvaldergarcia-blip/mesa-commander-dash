
-- ===== SUPPLIERS =====
CREATE TABLE public.label_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_label_suppliers_restaurant ON public.label_suppliers(restaurant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_suppliers TO authenticated;
GRANT ALL ON public.label_suppliers TO service_role;
ALTER TABLE public.label_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "label_suppliers_tenant_all" ON public.label_suppliers FOR ALL TO authenticated
  USING (is_member_or_admin(restaurant_id)) WITH CHECK (is_member_or_admin(restaurant_id));
CREATE TRIGGER trg_label_suppliers_upd BEFORE UPDATE ON public.label_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== ADD default_supplier + status guard on label_products =====
ALTER TABLE public.label_products
  ADD COLUMN IF NOT EXISTS default_supplier_id UUID REFERENCES public.label_suppliers(id) ON DELETE SET NULL;

-- ===== ALIASES (o sistema aprende como cada fornecedor chama cada produto) =====
CREATE TABLE public.label_product_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.label_products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.label_suppliers(id) ON DELETE SET NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, alias_normalized)
);
CREATE INDEX idx_label_aliases_restaurant ON public.label_product_aliases(restaurant_id);
CREATE INDEX idx_label_aliases_product ON public.label_product_aliases(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_product_aliases TO authenticated;
GRANT ALL ON public.label_product_aliases TO service_role;
ALTER TABLE public.label_product_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "label_aliases_tenant_all" ON public.label_product_aliases FOR ALL TO authenticated
  USING (is_member_or_admin(restaurant_id)) WITH CHECK (is_member_or_admin(restaurant_id));
CREATE TRIGGER trg_label_aliases_upd BEFORE UPDATE ON public.label_product_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== RECEIPTS =====
CREATE TABLE public.label_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  supplier_id UUID REFERENCES public.label_suppliers(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','csv','xml','excel')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_info','ready_to_print','confirmed','canceled')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_label_receipts_restaurant ON public.label_receipts(restaurant_id, received_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_receipts TO authenticated;
GRANT ALL ON public.label_receipts TO service_role;
ALTER TABLE public.label_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "label_receipts_tenant_all" ON public.label_receipts FOR ALL TO authenticated
  USING (is_member_or_admin(restaurant_id)) WITH CHECK (is_member_or_admin(restaurant_id));
CREATE TRIGGER trg_label_receipts_upd BEFORE UPDATE ON public.label_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== RECEIPT ITEMS =====
CREATE TABLE public.label_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.label_receipts(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL,
  raw_name TEXT NOT NULL,
  product_id UUID REFERENCES public.label_products(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'un',
  price_cents INTEGER,
  needs_info BOOLEAN NOT NULL DEFAULT false,
  missing_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  labels_prepared INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_label_receipt_items_receipt ON public.label_receipt_items(receipt_id);
CREATE INDEX idx_label_receipt_items_restaurant ON public.label_receipt_items(restaurant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_receipt_items TO authenticated;
GRANT ALL ON public.label_receipt_items TO service_role;
ALTER TABLE public.label_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "label_receipt_items_tenant_all" ON public.label_receipt_items FOR ALL TO authenticated
  USING (is_member_or_admin(restaurant_id)) WITH CHECK (is_member_or_admin(restaurant_id));
CREATE TRIGGER trg_label_receipt_items_upd BEFORE UPDATE ON public.label_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== STOCK MOVEMENTS (livro-razão de eventos) =====
CREATE TABLE public.label_stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('receipt','label_issued','discharge','waste','transfer','adjustment')),
  product_id UUID REFERENCES public.label_products(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.label_suppliers(id) ON DELETE SET NULL,
  receipt_id UUID REFERENCES public.label_receipts(id) ON DELETE SET NULL,
  issuance_id UUID REFERENCES public.label_issuances(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'un',
  employee_id UUID,
  user_id UUID,
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_label_movements_restaurant ON public.label_stock_movements(restaurant_id, occurred_at DESC);
CREATE INDEX idx_label_movements_event ON public.label_stock_movements(event_type);
CREATE INDEX idx_label_movements_product ON public.label_stock_movements(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_stock_movements TO authenticated;
GRANT ALL ON public.label_stock_movements TO service_role;
ALTER TABLE public.label_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "label_movements_tenant_all" ON public.label_stock_movements FOR ALL TO authenticated
  USING (is_member_or_admin(restaurant_id)) WITH CHECK (is_member_or_admin(restaurant_id));

-- ===== RPC: match_or_learn_alias =====
CREATE OR REPLACE FUNCTION public.label_match_alias(_restaurant_id UUID, _raw TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm TEXT;
  _pid UUID;
BEGIN
  IF NOT is_member_or_admin(_restaurant_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  _norm := lower(regexp_replace(trim(_raw), '\s+', ' ', 'g'));

  -- 1) alias table
  SELECT product_id INTO _pid
  FROM public.label_product_aliases
  WHERE restaurant_id = _restaurant_id AND alias_normalized = _norm
  LIMIT 1;
  IF _pid IS NOT NULL THEN RETURN _pid; END IF;

  -- 2) exact product name (case-insensitive)
  SELECT id INTO _pid
  FROM public.label_products
  WHERE restaurant_id = _restaurant_id
    AND lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = _norm
  LIMIT 1;
  IF _pid IS NOT NULL THEN RETURN _pid; END IF;

  -- 3) substring heuristic (raw contains product name OR vice-versa)
  SELECT id INTO _pid
  FROM public.label_products
  WHERE restaurant_id = _restaurant_id
    AND (
      _norm LIKE '%' || lower(name) || '%'
      OR lower(name) LIKE '%' || _norm || '%'
    )
  ORDER BY length(name) DESC
  LIMIT 1;
  RETURN _pid;
END;
$$;

CREATE OR REPLACE FUNCTION public.label_learn_alias(_restaurant_id UUID, _raw TEXT, _product_id UUID, _supplier_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _norm TEXT;
BEGIN
  IF NOT is_member_or_admin(_restaurant_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  _norm := lower(regexp_replace(trim(_raw), '\s+', ' ', 'g'));
  INSERT INTO public.label_product_aliases (restaurant_id, alias, alias_normalized, product_id, supplier_id)
  VALUES (_restaurant_id, _raw, _norm, _product_id, _supplier_id)
  ON CONFLICT (restaurant_id, alias_normalized)
  DO UPDATE SET usage_count = public.label_product_aliases.usage_count + 1,
                product_id = EXCLUDED.product_id,
                updated_at = now();
END;
$$;

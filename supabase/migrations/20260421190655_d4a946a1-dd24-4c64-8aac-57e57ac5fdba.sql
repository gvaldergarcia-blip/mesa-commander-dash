-- Tabela de produtos para etiquetas
CREATE TABLE public.label_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  validity_days INTEGER NOT NULL CHECK (validity_days > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para performance
CREATE INDEX idx_label_products_restaurant ON public.label_products(restaurant_id);

-- RLS
ALTER TABLE public.label_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "label_products_tenant_select"
ON public.label_products FOR SELECT
TO authenticated
USING (is_member_or_admin(restaurant_id));

CREATE POLICY "label_products_tenant_insert"
ON public.label_products FOR INSERT
TO authenticated
WITH CHECK (is_member_or_admin(restaurant_id));

CREATE POLICY "label_products_tenant_update"
ON public.label_products FOR UPDATE
TO authenticated
USING (is_member_or_admin(restaurant_id));

CREATE POLICY "label_products_tenant_delete"
ON public.label_products FOR DELETE
TO authenticated
USING (is_member_or_admin(restaurant_id));

-- Trigger para updated_at
CREATE TRIGGER update_label_products_updated_at
BEFORE UPDATE ON public.label_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
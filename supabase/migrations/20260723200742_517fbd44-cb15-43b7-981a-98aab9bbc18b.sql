
-- Rastreabilidade completa: recebimento -> etiqueta -> produção interna

ALTER TABLE public.label_receipts
  ADD COLUMN IF NOT EXISTS traceability_lot text,
  ADD COLUMN IF NOT EXISTS lot_source text CHECK (lot_source IN ('supplier','generated'));

CREATE UNIQUE INDEX IF NOT EXISTS label_receipts_traceability_lot_key
  ON public.label_receipts(traceability_lot);

ALTER TABLE public.label_receipt_items
  ADD COLUMN IF NOT EXISTS supplier_lot text;

ALTER TABLE public.label_issuances
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.label_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_lot text,
  ADD COLUMN IF NOT EXISTS traceability_lot text,
  ADD COLUMN IF NOT EXISTS origin_issuance_id uuid REFERENCES public.label_issuances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_traceability_lot text;

CREATE INDEX IF NOT EXISTS label_issuances_traceability_lot_idx ON public.label_issuances(traceability_lot);
CREATE INDEX IF NOT EXISTS label_issuances_origin_idx ON public.label_issuances(origin_issuance_id);
CREATE INDEX IF NOT EXISTS label_issuances_supplier_idx ON public.label_issuances(supplier_id);

-- Sequência e geração de código MesaClik para recebimentos sem lote do fornecedor
CREATE SEQUENCE IF NOT EXISTS public.label_receipt_lot_seq;

CREATE OR REPLACE FUNCTION public.label_generate_receipt_lot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq bigint;
BEGIN
  IF NEW.traceability_lot IS NULL THEN
    v_seq := nextval('public.label_receipt_lot_seq');
    NEW.traceability_lot := 'REC-' || to_char(coalesce(NEW.received_at, now()), 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');
    IF NEW.lot_source IS NULL THEN NEW.lot_source := 'generated'; END IF;
  ELSE
    IF NEW.lot_source IS NULL THEN NEW.lot_source := 'supplier'; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_label_receipts_lot ON public.label_receipts;
CREATE TRIGGER trg_label_receipts_lot BEFORE INSERT ON public.label_receipts
FOR EACH ROW EXECUTE FUNCTION public.label_generate_receipt_lot();

-- Backfill de recebimentos existentes
UPDATE public.label_receipts
SET traceability_lot = 'REC-' || to_char(received_at,'YYYYMMDD') || '-' || lpad(nextval('public.label_receipt_lot_seq')::text,4,'0'),
    lot_source = COALESCE(lot_source, 'generated')
WHERE traceability_lot IS NULL;

-- Trigger: etiquetas herdam rastreabilidade do recebimento e da produção-origem
CREATE OR REPLACE FUNCTION public.label_issuance_inherit_traceability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  o record;
BEGIN
  IF NEW.receipt_id IS NOT NULL THEN
    SELECT supplier_id, traceability_lot
      INTO r
      FROM public.label_receipts WHERE id = NEW.receipt_id;
    IF NEW.traceability_lot IS NULL THEN NEW.traceability_lot := r.traceability_lot; END IF;
    IF NEW.supplier_id IS NULL THEN NEW.supplier_id := r.supplier_id; END IF;
    -- Tratar batch como lote do fornecedor quando não é prefixo interno
    IF NEW.supplier_lot IS NULL AND NEW.batch IS NOT NULL
       AND NEW.batch !~ '^(PI-|PRD-|MC-|REC-)' THEN
      NEW.supplier_lot := NEW.batch;
    END IF;
  END IF;

  IF NEW.origin_issuance_id IS NOT NULL AND NEW.origin_traceability_lot IS NULL THEN
    SELECT traceability_lot, supplier_id, supplier_lot
      INTO o
      FROM public.label_issuances WHERE id = NEW.origin_issuance_id;
    NEW.origin_traceability_lot := o.traceability_lot;
    IF NEW.supplier_id IS NULL THEN NEW.supplier_id := o.supplier_id; END IF;
    IF NEW.supplier_lot IS NULL THEN NEW.supplier_lot := o.supplier_lot; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_label_issuance_trace ON public.label_issuances;
CREATE TRIGGER trg_label_issuance_trace BEFORE INSERT ON public.label_issuances
FOR EACH ROW EXECUTE FUNCTION public.label_issuance_inherit_traceability();

-- Backfill de issuances existentes com base no recebimento
UPDATE public.label_issuances li
SET traceability_lot = r.traceability_lot,
    supplier_id = COALESCE(li.supplier_id, r.supplier_id)
FROM public.label_receipts r
WHERE li.receipt_id = r.id
  AND li.traceability_lot IS NULL;

-- Sequência para código único de produção interna
CREATE SEQUENCE IF NOT EXISTS public.label_production_lot_seq;

CREATE OR REPLACE FUNCTION public.label_generate_production_lot()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'PRD-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('public.label_production_lot_seq')::text,3,'0');
$$;

GRANT EXECUTE ON FUNCTION public.label_generate_production_lot() TO authenticated, anon, service_role;

-- Lista lotes ativos por produto (para o seletor da Produção Interna)
CREATE OR REPLACE FUNCTION public.label_active_lots_for_product(_product_id uuid)
RETURNS TABLE (
  issuance_id uuid,
  batch text,
  supplier_lot text,
  traceability_lot text,
  supplier_id uuid,
  supplier_name text,
  receipt_id uuid,
  received_at timestamptz,
  expiry_date timestamptz,
  units_remaining integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT li.id,
         li.batch,
         li.supplier_lot,
         li.traceability_lot,
         li.supplier_id,
         s.name,
         li.receipt_id,
         r.received_at,
         li.expiry_date,
         GREATEST(0, li.quantity - COALESCE(li.units_used, 0))::int
  FROM public.label_issuances li
  LEFT JOIN public.label_suppliers s ON s.id = li.supplier_id
  LEFT JOIN public.label_receipts r ON r.id = li.receipt_id
  WHERE li.label_product_id = _product_id
    AND li.status = 'active'
    AND li.expiry_date > now()
    AND COALESCE(li.units_used, 0) < li.quantity
  ORDER BY li.expiry_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.label_active_lots_for_product(uuid) TO authenticated, anon, service_role;

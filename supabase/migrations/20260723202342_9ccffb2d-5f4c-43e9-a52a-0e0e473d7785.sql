
CREATE SEQUENCE IF NOT EXISTS public.label_manipulation_lot_seq;

CREATE OR REPLACE FUNCTION public.label_generate_manipulation_lot()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'MAN-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('public.label_manipulation_lot_seq')::text,3,'0');
$$;

GRANT EXECUTE ON FUNCTION public.label_generate_manipulation_lot() TO authenticated, anon, service_role;

-- Ajusta o trigger de rastreabilidade para reconhecer o prefixo MAN- como lote interno,
-- e não como lote do fornecedor.
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
    IF NEW.supplier_lot IS NULL AND NEW.batch IS NOT NULL
       AND NEW.batch !~ '^(PI-|PRD-|MC-|REC-|MAN-)' THEN
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


-- =========================================================
-- PASSO 1: Fundação de eventos operacionais (módulo Etiquetas)
-- =========================================================

-- 1. ENUM de tipos de evento
DO $$ BEGIN
  CREATE TYPE public.kitchen_event_type AS ENUM (
    'receipt',
    'label_issued',
    'label_discharged',
    'manipulation',
    'consumption',
    'loss',
    'transfer',
    'stock_check',
    'purchase_request'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela principal de eventos
CREATE TABLE IF NOT EXISTS public.kitchen_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  event_type public.kitchen_event_type NOT NULL,
  product_id UUID NULL,
  supplier_id UUID NULL,
  employee_id UUID NULL,
  receipt_id UUID NULL,
  label_id UUID NULL,
  quantity NUMERIC NULL,
  unit TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kitchen_events_restaurant_time_idx
  ON public.kitchen_events (restaurant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS kitchen_events_type_idx
  ON public.kitchen_events (restaurant_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS kitchen_events_product_idx
  ON public.kitchen_events (product_id, occurred_at DESC);

-- 3. GRANTS
GRANT SELECT ON public.kitchen_events TO authenticated;
GRANT ALL ON public.kitchen_events TO service_role;

-- 4. RLS
ALTER TABLE public.kitchen_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kitchen_events_select_members" ON public.kitchen_events;
CREATE POLICY "kitchen_events_select_members"
  ON public.kitchen_events
  FOR SELECT
  TO authenticated
  USING (public.is_member_or_admin(restaurant_id));

-- somente sistema/edge escreve; sem policy de insert/update/delete para authenticated

-- 5. Função utilitária para inserir eventos com segurança elevada
CREATE OR REPLACE FUNCTION public.log_kitchen_event(
  p_restaurant_id UUID,
  p_event_type public.kitchen_event_type,
  p_product_id UUID DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_receipt_id UUID DEFAULT NULL,
  p_label_id UUID DEFAULT NULL,
  p_quantity NUMERIC DEFAULT NULL,
  p_unit TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT now(),
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.kitchen_events (
    restaurant_id, event_type, product_id, supplier_id, employee_id,
    receipt_id, label_id, quantity, unit, occurred_at, payload, source
  ) VALUES (
    p_restaurant_id, p_event_type, p_product_id, p_supplier_id, p_employee_id,
    p_receipt_id, p_label_id, p_quantity, p_unit, COALESCE(p_occurred_at, now()),
    COALESCE(p_payload, '{}'::jsonb), p_source
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- =========================================================
-- 6. TRIGGERS DE ESPELHAMENTO
-- =========================================================

-- 6.1 label_issuances -> label_issued
CREATE OR REPLACE FUNCTION public.trg_kitchen_event_from_issuance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.kitchen_events (
      restaurant_id, event_type, product_id, employee_id, label_id,
      quantity, occurred_at, source, payload
    ) VALUES (
      NEW.restaurant_id, 'label_issued', NEW.label_product_id, NEW.employee_id, NEW.id,
      NEW.quantity, NEW.created_at, 'label_issuances',
      jsonb_build_object(
        'product_name', NEW.product_name,
        'conservation_method', NEW.conservation_method,
        'expiry_date', NEW.expiry_date,
        'manufacture_date', NEW.manufacture_date,
        'batch', NEW.batch
      )
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'discharged' AND COALESCE(OLD.status,'') <> 'discharged' THEN
    INSERT INTO public.kitchen_events (
      restaurant_id, event_type, product_id, employee_id, label_id,
      quantity, occurred_at, source, payload
    ) VALUES (
      NEW.restaurant_id, 'label_discharged', NEW.label_product_id, NEW.employee_id, NEW.id,
      NEW.quantity, COALESCE(NEW.resolved_at, now()), 'label_issuances',
      jsonb_build_object(
        'product_name', NEW.product_name,
        'reason', NEW.discharge_reason
      )
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_kitchen_event_issuance_ins ON public.label_issuances;
CREATE TRIGGER trg_kitchen_event_issuance_ins
  AFTER INSERT ON public.label_issuances
  FOR EACH ROW EXECUTE FUNCTION public.trg_kitchen_event_from_issuance();

DROP TRIGGER IF EXISTS trg_kitchen_event_issuance_upd ON public.label_issuances;
CREATE TRIGGER trg_kitchen_event_issuance_upd
  AFTER UPDATE OF status ON public.label_issuances
  FOR EACH ROW EXECUTE FUNCTION public.trg_kitchen_event_from_issuance();

-- 6.2 label_discharges -> label_discharged (fonte alternativa)
CREATE OR REPLACE FUNCTION public.trg_kitchen_event_from_discharge()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product UUID;
BEGIN
  SELECT label_product_id INTO v_product FROM public.label_issuances WHERE id = NEW.label_id;
  INSERT INTO public.kitchen_events (
    restaurant_id, event_type, product_id, employee_id, label_id,
    occurred_at, source, payload
  ) VALUES (
    NEW.restaurant_id, 'label_discharged', v_product, NEW.employee_id, NEW.label_id,
    NEW.discharged_at, 'label_discharges',
    jsonb_build_object('reason', NEW.reason, 'notes', NEW.notes)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_kitchen_event_discharge_ins ON public.label_discharges;
CREATE TRIGGER trg_kitchen_event_discharge_ins
  AFTER INSERT ON public.label_discharges
  FOR EACH ROW EXECUTE FUNCTION public.trg_kitchen_event_from_discharge();

-- 6.3 label_receipts -> receipt (marca o cabeçalho do recebimento)
CREATE OR REPLACE FUNCTION public.trg_kitchen_event_from_receipt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.kitchen_events (
    restaurant_id, event_type, supplier_id, receipt_id,
    occurred_at, source, payload
  ) VALUES (
    NEW.restaurant_id, 'receipt', NEW.supplier_id, NEW.id,
    NEW.received_at, 'label_receipts',
    jsonb_build_object('source', NEW.source, 'reference', NEW.reference, 'status', NEW.status)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_kitchen_event_receipt_ins ON public.label_receipts;
CREATE TRIGGER trg_kitchen_event_receipt_ins
  AFTER INSERT ON public.label_receipts
  FOR EACH ROW EXECUTE FUNCTION public.trg_kitchen_event_from_receipt();

-- 6.4 label_stock_movements -> mapeia para o tipo semântico
CREATE OR REPLACE FUNCTION public.trg_kitchen_event_from_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type public.kitchen_event_type;
BEGIN
  v_type := CASE lower(NEW.event_type)
    WHEN 'in'          THEN 'receipt'::public.kitchen_event_type
    WHEN 'receipt'     THEN 'receipt'::public.kitchen_event_type
    WHEN 'out'         THEN 'consumption'::public.kitchen_event_type
    WHEN 'consumption' THEN 'consumption'::public.kitchen_event_type
    WHEN 'loss'        THEN 'loss'::public.kitchen_event_type
    WHEN 'waste'       THEN 'loss'::public.kitchen_event_type
    WHEN 'transfer'    THEN 'transfer'::public.kitchen_event_type
    WHEN 'manipulation'THEN 'manipulation'::public.kitchen_event_type
    ELSE 'manipulation'::public.kitchen_event_type
  END;

  INSERT INTO public.kitchen_events (
    restaurant_id, event_type, product_id, supplier_id, employee_id,
    receipt_id, label_id, quantity, unit, occurred_at, source, payload
  ) VALUES (
    NEW.restaurant_id, v_type, NEW.product_id, NEW.supplier_id, NEW.employee_id,
    NEW.receipt_id, NEW.issuance_id, NEW.quantity, NEW.unit,
    NEW.occurred_at, 'label_stock_movements',
    jsonb_build_object('raw_event_type', NEW.event_type, 'notes', NEW.notes)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_kitchen_event_movement_ins ON public.label_stock_movements;
CREATE TRIGGER trg_kitchen_event_movement_ins
  AFTER INSERT ON public.label_stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.trg_kitchen_event_from_movement();

-- 6.5 stock_check_logs -> stock_check
CREATE OR REPLACE FUNCTION public.trg_kitchen_event_from_stock_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.kitchen_events (
    restaurant_id, event_type, product_id, employee_id,
    occurred_at, source, payload
  ) VALUES (
    NEW.restaurant_id, 'stock_check', NEW.product_id, NEW.marked_by_employee_id,
    NEW.created_at, 'stock_check_logs',
    jsonb_build_object('status', NEW.status, 'product_name', NEW.product_name, 'marked_by_name', NEW.marked_by_name)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_kitchen_event_stock_check_ins ON public.stock_check_logs;
CREATE TRIGGER trg_kitchen_event_stock_check_ins
  AFTER INSERT ON public.stock_check_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_kitchen_event_from_stock_check();

-- =========================================================
-- 7. VIEWS DERIVADAS
-- =========================================================

-- 7.1 Diário operacional
CREATE OR REPLACE VIEW public.v_operational_diary AS
SELECT
  e.id,
  e.restaurant_id,
  e.event_type,
  e.occurred_at,
  e.quantity,
  e.unit,
  e.payload,
  e.source,
  e.product_id,
  p.name        AS product_name,
  p.category    AS product_category,
  e.supplier_id,
  s.name        AS supplier_name,
  e.employee_id,
  emp.name      AS employee_name,
  e.receipt_id,
  e.label_id
FROM public.kitchen_events e
LEFT JOIN public.label_products  p   ON p.id = e.product_id
LEFT JOIN public.label_suppliers s   ON s.id = e.supplier_id
LEFT JOIN public.label_employees emp ON emp.id = e.employee_id;

GRANT SELECT ON public.v_operational_diary TO authenticated;

-- 7.2 Saldo de estoque (baseado em eventos com quantidade)
CREATE OR REPLACE VIEW public.v_stock_balance AS
SELECT
  e.restaurant_id,
  e.product_id,
  p.name AS product_name,
  p.unit AS product_unit,
  SUM(
    CASE
      WHEN e.event_type = 'receipt'      AND e.quantity IS NOT NULL THEN  e.quantity
      WHEN e.event_type IN ('consumption','loss','transfer') AND e.quantity IS NOT NULL THEN -e.quantity
      ELSE 0
    END
  ) AS balance,
  MAX(e.occurred_at) FILTER (WHERE e.event_type = 'receipt')     AS last_receipt_at,
  MAX(e.occurred_at) FILTER (WHERE e.event_type = 'consumption') AS last_consumption_at,
  COUNT(*) FILTER (WHERE e.quantity IS NOT NULL) AS quantitative_events
FROM public.kitchen_events e
LEFT JOIN public.label_products p ON p.id = e.product_id
WHERE e.product_id IS NOT NULL
GROUP BY e.restaurant_id, e.product_id, p.name, p.unit;

GRANT SELECT ON public.v_stock_balance TO authenticated;

-- =========================================================
-- 8. BACKFILL (últimos 90 dias)
-- =========================================================

-- 8.1 Emissões
INSERT INTO public.kitchen_events (
  restaurant_id, event_type, product_id, employee_id, label_id,
  quantity, occurred_at, source, payload
)
SELECT
  i.restaurant_id, 'label_issued', i.label_product_id, i.employee_id, i.id,
  i.quantity, i.created_at, 'backfill:label_issuances',
  jsonb_build_object(
    'product_name', i.product_name,
    'conservation_method', i.conservation_method,
    'expiry_date', i.expiry_date
  )
FROM public.label_issuances i
WHERE i.created_at > now() - interval '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.kitchen_events k
    WHERE k.label_id = i.id AND k.event_type = 'label_issued'
  );

-- 8.2 Baixas via UPDATE em label_issuances
INSERT INTO public.kitchen_events (
  restaurant_id, event_type, product_id, employee_id, label_id,
  quantity, occurred_at, source, payload
)
SELECT
  i.restaurant_id, 'label_discharged', i.label_product_id, i.employee_id, i.id,
  i.quantity, COALESCE(i.resolved_at, i.updated_at), 'backfill:label_issuances',
  jsonb_build_object('product_name', i.product_name, 'reason', i.discharge_reason)
FROM public.label_issuances i
WHERE i.status = 'discharged'
  AND COALESCE(i.resolved_at, i.updated_at) > now() - interval '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.kitchen_events k
    WHERE k.label_id = i.id AND k.event_type = 'label_discharged'
  );

-- 8.3 Baixas explícitas
INSERT INTO public.kitchen_events (
  restaurant_id, event_type, product_id, employee_id, label_id,
  occurred_at, source, payload
)
SELECT
  d.restaurant_id, 'label_discharged',
  (SELECT label_product_id FROM public.label_issuances WHERE id = d.label_id),
  d.employee_id, d.label_id,
  d.discharged_at, 'backfill:label_discharges',
  jsonb_build_object('reason', d.reason, 'notes', d.notes)
FROM public.label_discharges d
WHERE d.discharged_at > now() - interval '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.kitchen_events k
    WHERE k.label_id = d.label_id
      AND k.event_type = 'label_discharged'
      AND k.occurred_at = d.discharged_at
  );

-- 8.4 Recebimentos (cabeçalho)
INSERT INTO public.kitchen_events (
  restaurant_id, event_type, supplier_id, receipt_id,
  occurred_at, source, payload
)
SELECT
  r.restaurant_id, 'receipt', r.supplier_id, r.id,
  r.received_at, 'backfill:label_receipts',
  jsonb_build_object('source', r.source, 'reference', r.reference, 'status', r.status)
FROM public.label_receipts r
WHERE r.received_at > now() - interval '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.kitchen_events k
    WHERE k.receipt_id = r.id AND k.event_type = 'receipt'
  );

-- 8.5 Movimentações de estoque
INSERT INTO public.kitchen_events (
  restaurant_id, event_type, product_id, supplier_id, employee_id,
  receipt_id, label_id, quantity, unit, occurred_at, source, payload
)
SELECT
  m.restaurant_id,
  CASE lower(m.event_type)
    WHEN 'in'          THEN 'receipt'::public.kitchen_event_type
    WHEN 'receipt'     THEN 'receipt'::public.kitchen_event_type
    WHEN 'out'         THEN 'consumption'::public.kitchen_event_type
    WHEN 'consumption' THEN 'consumption'::public.kitchen_event_type
    WHEN 'loss'        THEN 'loss'::public.kitchen_event_type
    WHEN 'waste'       THEN 'loss'::public.kitchen_event_type
    WHEN 'transfer'    THEN 'transfer'::public.kitchen_event_type
    WHEN 'manipulation'THEN 'manipulation'::public.kitchen_event_type
    ELSE 'manipulation'::public.kitchen_event_type
  END,
  m.product_id, m.supplier_id, m.employee_id,
  m.receipt_id, m.issuance_id, m.quantity, m.unit,
  m.occurred_at, 'backfill:label_stock_movements',
  jsonb_build_object('raw_event_type', m.event_type, 'notes', m.notes)
FROM public.label_stock_movements m
WHERE m.occurred_at > now() - interval '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.kitchen_events k
    WHERE k.source = 'backfill:label_stock_movements'
      AND k.product_id IS NOT DISTINCT FROM m.product_id
      AND k.occurred_at = m.occurred_at
      AND k.quantity IS NOT DISTINCT FROM m.quantity
  );

-- 8.6 Checagens de estoque
INSERT INTO public.kitchen_events (
  restaurant_id, event_type, product_id, employee_id,
  occurred_at, source, payload
)
SELECT
  c.restaurant_id, 'stock_check', c.product_id, c.marked_by_employee_id,
  c.created_at, 'backfill:stock_check_logs',
  jsonb_build_object('status', c.status, 'product_name', c.product_name, 'marked_by_name', c.marked_by_name)
FROM public.stock_check_logs c
WHERE c.created_at > now() - interval '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.kitchen_events k
    WHERE k.source = 'backfill:stock_check_logs'
      AND k.product_id IS NOT DISTINCT FROM c.product_id
      AND k.occurred_at = c.created_at
  );

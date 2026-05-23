
-- =====================================================
-- ETIQUETAS — Fase 1: estrutura
-- =====================================================

-- 1. label_employees ----------------------------------
CREATE TABLE IF NOT EXISTS public.label_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  role text,
  pin text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT label_employees_status_chk CHECK (status IN ('active','inactive')),
  CONSTRAINT label_employees_pin_chk CHECK (pin IS NULL OR pin ~ '^[0-9]{4}$')
);
CREATE INDEX IF NOT EXISTS idx_label_employees_restaurant ON public.label_employees(restaurant_id);
ALTER TABLE public.label_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY label_employees_tenant_select ON public.label_employees FOR SELECT USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_employees_tenant_insert ON public.label_employees FOR INSERT WITH CHECK (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_employees_tenant_update ON public.label_employees FOR UPDATE USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_employees_tenant_delete ON public.label_employees FOR DELETE USING (public.is_member_or_admin(restaurant_id));

-- 2. label_product_groups -----------------------------
CREATE TABLE IF NOT EXISTS public.label_product_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#FF6200',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_label_product_groups_restaurant ON public.label_product_groups(restaurant_id);
ALTER TABLE public.label_product_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY label_groups_tenant_select ON public.label_product_groups FOR SELECT USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_groups_tenant_insert ON public.label_product_groups FOR INSERT WITH CHECK (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_groups_tenant_update ON public.label_product_groups FOR UPDATE USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_groups_tenant_delete ON public.label_product_groups FOR DELETE USING (public.is_member_or_admin(restaurant_id));

-- 3. label_products — extensões -----------------------
ALTER TABLE public.label_products
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.label_product_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conservation_method text NOT NULL DEFAULT 'refrigerated',
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS default_observation text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.label_products
  DROP CONSTRAINT IF EXISTS label_products_conservation_chk;
ALTER TABLE public.label_products
  ADD CONSTRAINT label_products_conservation_chk CHECK (conservation_method IN ('refrigerated','frozen','ambient','hot'));

ALTER TABLE public.label_products
  DROP CONSTRAINT IF EXISTS label_products_status_chk;
ALTER TABLE public.label_products
  ADD CONSTRAINT label_products_status_chk CHECK (status IN ('active','inactive'));

-- 4. label_issuances — extensões ----------------------
ALTER TABLE public.label_issuances
  ADD COLUMN IF NOT EXISTS unique_code text,
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.label_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conservation_method text,
  ADD COLUMN IF NOT EXISTS discharge_reason text;

-- Permitir 'discharged' no status
ALTER TABLE public.label_issuances
  DROP CONSTRAINT IF EXISTS label_issuances_status_chk;
ALTER TABLE public.label_issuances
  ADD CONSTRAINT label_issuances_status_chk CHECK (status IN ('active','consumed','discarded','discharged','expired'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_label_issuances_unique_code ON public.label_issuances(unique_code) WHERE unique_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_label_issuances_employee ON public.label_issuances(employee_id);

-- Backfill unique_code para linhas existentes
UPDATE public.label_issuances
SET unique_code = upper(substring(replace(id::text,'-',''), 1, 6))
WHERE unique_code IS NULL;

-- Função geradora de código curto único (6 chars alfanum)
CREATE OR REPLACE FUNCTION public.generate_label_unique_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  exists_check int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random()*length(chars))::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_check FROM public.label_issuances WHERE unique_code = code;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN code;
END;
$$;

-- Trigger para gerar unique_code automaticamente
CREATE OR REPLACE FUNCTION public.label_issuance_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.unique_code IS NULL THEN
    NEW.unique_code := public.generate_label_unique_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_label_issuance_before_insert ON public.label_issuances;
CREATE TRIGGER trg_label_issuance_before_insert
BEFORE INSERT ON public.label_issuances
FOR EACH ROW EXECUTE FUNCTION public.label_issuance_before_insert();

-- 5. label_discharges ---------------------------------
CREATE TABLE IF NOT EXISTS public.label_discharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  label_id uuid NOT NULL REFERENCES public.label_issuances(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.label_employees(id) ON DELETE SET NULL,
  reason text NOT NULL,
  notes text,
  discharged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT label_discharges_reason_chk CHECK (reason IN ('use','loss','error'))
);
CREATE INDEX IF NOT EXISTS idx_label_discharges_restaurant ON public.label_discharges(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_label_discharges_label ON public.label_discharges(label_id);
ALTER TABLE public.label_discharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY label_discharges_tenant_select ON public.label_discharges FOR SELECT USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_discharges_tenant_insert ON public.label_discharges FOR INSERT WITH CHECK (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_discharges_tenant_update ON public.label_discharges FOR UPDATE USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY label_discharges_tenant_delete ON public.label_discharges FOR DELETE USING (public.is_member_or_admin(restaurant_id));

-- 6. RPC público: get_label_by_code -------------------
CREATE OR REPLACE FUNCTION public.get_label_by_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  restaurant_name text;
  employee_name text;
  discharge_rec record;
BEGIN
  SELECT * INTO rec FROM public.label_issuances WHERE unique_code = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT name INTO restaurant_name FROM public.restaurants WHERE id = rec.restaurant_id;
  SELECT name INTO employee_name FROM public.label_employees WHERE id = rec.employee_id;

  SELECT d.*, e.name AS employee_name
    INTO discharge_rec
  FROM public.label_discharges d
  LEFT JOIN public.label_employees e ON e.id = d.employee_id
  WHERE d.label_id = rec.id
  ORDER BY d.discharged_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'found', true,
    'id', rec.id,
    'unique_code', rec.unique_code,
    'product_name', rec.product_name,
    'manufacture_date', rec.manufacture_date,
    'expiry_date', rec.expiry_date,
    'quantity', rec.quantity,
    'batch', rec.batch,
    'conservation_method', rec.conservation_method,
    'notes', rec.notes,
    'status', rec.status,
    'is_expired', (rec.expiry_date < now()),
    'responsible', COALESCE(employee_name, rec.responsible),
    'restaurant_id', rec.restaurant_id,
    'restaurant_name', restaurant_name,
    'discharge', CASE WHEN discharge_rec.id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'reason', discharge_rec.reason,
        'notes', discharge_rec.notes,
        'discharged_at', discharge_rec.discharged_at,
        'employee_name', discharge_rec.employee_name
      ) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_label_by_code(text) TO anon, authenticated;

-- 7. RPC público: discharge_label_by_code -------------
CREATE OR REPLACE FUNCTION public.discharge_label_by_code(
  _code text,
  _reason text,
  _employee_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  IF _reason NOT IN ('use','loss','error') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_reason');
  END IF;

  SELECT * INTO rec FROM public.label_issuances WHERE unique_code = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF rec.status = 'discharged' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_discharged');
  END IF;

  INSERT INTO public.label_discharges (restaurant_id, label_id, employee_id, reason, notes)
  VALUES (rec.restaurant_id, rec.id, _employee_id, _reason, _notes);

  UPDATE public.label_issuances
  SET status = 'discharged',
      discharge_reason = _reason,
      resolved_at = now(),
      updated_at = now()
  WHERE id = rec.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discharge_label_by_code(text, text, uuid, text) TO anon, authenticated;

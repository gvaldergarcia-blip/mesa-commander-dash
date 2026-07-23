
-- 1) Colunas de unidades
ALTER TABLE public.label_issuances
  ADD COLUMN IF NOT EXISTS units_used int NOT NULL DEFAULT 0;

ALTER TABLE public.label_discharges
  ADD COLUMN IF NOT EXISTS units int NOT NULL DEFAULT 1;

-- Backfill: etiquetas já baixadas contam quantidade total como usada
UPDATE public.label_issuances
SET units_used = COALESCE(quantity, 1)
WHERE status = 'discharged' AND units_used = 0;

-- 2) RPC de baixa por código com suporte a unidades parciais
CREATE OR REPLACE FUNCTION public.discharge_label_by_code(
  _code text,
  _reason text,
  _employee_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL,
  _units int DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  canon text;
  qty int;
  used int;
  remaining int;
  will_use int;
  active_units_left int;
BEGIN
  SELECT * INTO rec FROM public.label_issuances
   WHERE unique_code = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF rec.status = 'discharged' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_discharged');
  END IF;

  qty := COALESCE(rec.quantity, 1);
  used := COALESCE(rec.units_used, 0);
  remaining := GREATEST(qty - used, 0);
  IF remaining <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_units_left');
  END IF;

  will_use := GREATEST(LEAST(COALESCE(_units, 1), remaining), 1);

  -- Mapeia motivo para a CHECK constraint (use/loss/error)
  canon := CASE lower(_reason)
    WHEN 'use' THEN 'use'
    WHEN 'consumo' THEN 'use'
    WHEN 'loss' THEN 'loss'
    WHEN 'vencimento' THEN 'loss'
    WHEN 'descarte' THEN 'loss'
    WHEN 'error' THEN 'error'
    WHEN 'outro' THEN 'error'
    ELSE 'error'
  END;

  INSERT INTO public.label_discharges (restaurant_id, label_id, employee_id, reason, notes, units)
  VALUES (rec.restaurant_id, rec.id, _employee_id, canon, _notes, will_use);

  IF (used + will_use) >= qty THEN
    UPDATE public.label_issuances
       SET units_used = qty,
           status = 'discharged',
           discharge_reason = _reason,
           resolved_at = now()
     WHERE id = rec.id;
  ELSE
    UPDATE public.label_issuances
       SET units_used = used + will_use
     WHERE id = rec.id;
  END IF;

  -- Se acabaram as unidades ativas do produto, marca "falta" no estoque
  IF rec.label_product_id IS NOT NULL THEN
    SELECT COALESCE(SUM(GREATEST(COALESCE(quantity,1) - COALESCE(units_used,0), 0)), 0)
      INTO active_units_left
      FROM public.label_issuances
     WHERE restaurant_id = rec.restaurant_id
       AND label_product_id = rec.label_product_id
       AND status <> 'discharged'
       AND expiry_date >= now();

    IF active_units_left <= 0 THEN
      INSERT INTO public.product_stock_status
        (restaurant_id, product_id, status, marked_by_employee_id, marked_by_name, marked_at, notes)
      VALUES
        (rec.restaurant_id, rec.label_product_id, 'falta', _employee_id, NULL, now(),
         'Auto: unidades esgotadas por baixa')
      ON CONFLICT (restaurant_id, product_id) DO UPDATE
        SET status = 'falta',
            marked_at = now(),
            notes = 'Auto: unidades esgotadas por baixa';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'units_used', will_use,
    'units_remaining', GREATEST(qty - (used + will_use), 0),
    'fully_discharged', (used + will_use) >= qty,
    'label_id', rec.id,
    'restaurant_id', rec.restaurant_id,
    'product_name', rec.product_name,
    'label_product_id', rec.label_product_id
  );
END;
$$;

-- 3) get_label_by_code inclui unidades restantes
CREATE OR REPLACE FUNCTION public.get_label_by_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  restaurant_name text;
  employee_name text;
  discharge_rec record;
  verif_rec record;
BEGIN
  SELECT * INTO rec FROM public.label_issuances WHERE unique_code = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT name INTO restaurant_name FROM public.restaurants WHERE id = rec.restaurant_id;
  SELECT name INTO employee_name FROM public.label_employees WHERE id = rec.employee_id;

  SELECT d.*, e.name AS employee_name INTO discharge_rec
    FROM public.label_discharges d
    LEFT JOIN public.label_employees e ON e.id = d.employee_id
   WHERE d.label_id = rec.id
   ORDER BY d.discharged_at DESC LIMIT 1;

  SELECT v.*, e.name AS employee_name INTO verif_rec
    FROM public.label_verifications v
    LEFT JOIN public.label_employees e ON e.id = v.employee_id
   WHERE v.label_id = rec.id
   ORDER BY v.verified_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'found', true,
    'id', rec.id,
    'unique_code', rec.unique_code,
    'product_name', rec.product_name,
    'manufacture_date', rec.manufacture_date,
    'expiry_date', rec.expiry_date,
    'quantity', rec.quantity,
    'units_used', COALESCE(rec.units_used, 0),
    'units_remaining', GREATEST(COALESCE(rec.quantity,1) - COALESCE(rec.units_used,0), 0),
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
        'employee_name', discharge_rec.employee_name,
        'units', discharge_rec.units
      ) END,
    'last_verification', CASE WHEN verif_rec.id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'verified_at', verif_rec.verified_at,
        'notes', verif_rec.notes,
        'employee_name', verif_rec.employee_name
      ) END
  );
END;
$$;

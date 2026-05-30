-- 1. Table
CREATE TABLE IF NOT EXISTS public.label_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  label_id uuid NOT NULL REFERENCES public.label_issuances(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.label_employees(id) ON DELETE SET NULL,
  notes text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_label_verif_label ON public.label_verifications(label_id);
CREATE INDEX IF NOT EXISTS idx_label_verif_restaurant ON public.label_verifications(restaurant_id);

GRANT SELECT, INSERT ON public.label_verifications TO authenticated;
GRANT ALL ON public.label_verifications TO service_role;

ALTER TABLE public.label_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view verifications"
ON public.label_verifications FOR SELECT
TO authenticated
USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "Service role inserts verifications"
ON public.label_verifications FOR INSERT
TO authenticated
WITH CHECK (public.is_member_or_admin(restaurant_id));

-- 2. RPC verify_label_by_code
CREATE OR REPLACE FUNCTION public.verify_label_by_code(
  _code text,
  _employee_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
BEGIN
  SELECT * INTO rec FROM public.label_issuances WHERE unique_code = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF rec.status = 'discharged' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_discharged');
  END IF;

  INSERT INTO public.label_verifications (restaurant_id, label_id, employee_id, notes)
  VALUES (rec.restaurant_id, rec.id, _employee_id, _notes);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Update get_label_by_code to include last verification
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

  SELECT d.*, e.name AS employee_name
    INTO discharge_rec
  FROM public.label_discharges d
  LEFT JOIN public.label_employees e ON e.id = d.employee_id
  WHERE d.label_id = rec.id
  ORDER BY d.discharged_at DESC
  LIMIT 1;

  SELECT v.*, e.name AS employee_name
    INTO verif_rec
  FROM public.label_verifications v
  LEFT JOIN public.label_employees e ON e.id = v.employee_id
  WHERE v.label_id = rec.id
  ORDER BY v.verified_at DESC
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
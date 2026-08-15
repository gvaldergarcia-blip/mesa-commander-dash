CREATE OR REPLACE FUNCTION public.label_stock_to_base(_qty numeric, _unit text)
RETURNS TABLE(base text, value numeric)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE lower(coalesce(trim(_unit),'un'))
      WHEN 'kg' THEN 'g' WHEN 'quilo' THEN 'g' WHEN 'g' THEN 'g' WHEN 'gr' THEN 'g'
      WHEN 'grama' THEN 'g' WHEN 'gramas' THEN 'g' WHEN 'mg' THEN 'g'
      WHEN 'l' THEN 'ml' WHEN 'lt' THEN 'ml' WHEN 'litro' THEN 'ml' WHEN 'ml' THEN 'ml'
      ELSE 'un'
    END,
    coalesce(_qty,0) * CASE lower(coalesce(trim(_unit),'un'))
      WHEN 'kg' THEN 1000 WHEN 'quilo' THEN 1000 WHEN 'mg' THEN 0.001
      WHEN 'l' THEN 1000 WHEN 'lt' THEN 1000 WHEN 'litro' THEN 1000
      ELSE 1
    END;
$$;

CREATE OR REPLACE FUNCTION public.label_product_balance(_restaurant_id uuid, _product_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(
    CASE WHEN m.event_type IN ('receipt','transfer','adjustment') THEN b.value
         WHEN m.event_type IN ('discharge','waste') THEN -b.value
         ELSE 0 END
  ), 0)
  FROM public.label_stock_movements m
  CROSS JOIN LATERAL public.label_stock_to_base(m.quantity, m.unit) b
  WHERE m.restaurant_id = _restaurant_id
    AND m.product_id = _product_id
    AND m.event_type IN ('receipt','transfer','adjustment','discharge','waste');
$$;

CREATE OR REPLACE FUNCTION public.label_register_usage(
  _code text,
  _quantity numeric,
  _unit text,
  _reason text DEFAULT 'use',
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
  b record;
  bal numeric;
  ev text;
BEGIN
  IF coalesce(_quantity,0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_quantity');
  END IF;

  SELECT * INTO rec FROM public.label_issuances WHERE unique_code = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF rec.label_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'label_without_product');
  END IF;

  SELECT * INTO b FROM public.label_stock_to_base(_quantity, _unit);
  bal := public.label_product_balance(rec.restaurant_id, rec.label_product_id);

  IF b.value > bal THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_stock',
      'balance_base', bal,
      'base', b.base
    );
  END IF;

  ev := CASE lower(coalesce(_reason,'use'))
          WHEN 'use' THEN 'discharge'
          WHEN 'consumo' THEN 'discharge'
          ELSE 'waste'
        END;

  INSERT INTO public.label_stock_movements
    (restaurant_id, event_type, product_id, issuance_id, receipt_id, quantity, unit, employee_id, user_id, notes)
  VALUES
    (rec.restaurant_id, ev, rec.label_product_id, rec.id, NULL, _quantity, lower(coalesce(trim(_unit),'un')),
     _employee_id, auth.uid(), _notes);

  RETURN jsonb_build_object(
    'success', true,
    'base', b.base,
    'balance_before_base', bal,
    'balance_after_base', bal - b.value,
    'product_id', rec.label_product_id,
    'product_name', rec.product_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.label_stock_to_base(numeric, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.label_product_balance(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.label_register_usage(text, numeric, text, text, uuid, text) TO anon, authenticated, service_role;
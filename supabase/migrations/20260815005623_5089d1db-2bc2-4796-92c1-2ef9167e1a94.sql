CREATE OR REPLACE FUNCTION public.label_balance_by_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
  resolved_product_id uuid;
  product_unit text;
  bal numeric;
  b record;
  last_unit text;
BEGIN
  SELECT * INTO rec
  FROM public.label_issuances
  WHERE unique_code = upper(trim(_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  resolved_product_id := rec.label_product_id;

  IF resolved_product_id IS NULL THEN
    SELECT p.id INTO resolved_product_id
    FROM public.label_products p
    WHERE p.restaurant_id = rec.restaurant_id
      AND lower(trim(p.name)) = lower(trim(rec.product_name))
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  IF resolved_product_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'label_without_product');
  END IF;

  SELECT lower(coalesce(nullif(trim(p.unit), ''), 'un'))
  INTO product_unit
  FROM public.label_products p
  WHERE p.id = resolved_product_id;

  bal := public.label_product_balance(rec.restaurant_id, resolved_product_id);

  SELECT lower(coalesce(nullif(trim(m.unit), ''), product_unit, 'un')) INTO last_unit
  FROM public.label_stock_movements m
  WHERE m.restaurant_id = rec.restaurant_id
    AND m.product_id = resolved_product_id
    AND m.event_type IN ('receipt','production','transfer','adjustment')
  ORDER BY m.occurred_at DESC
  LIMIT 1;

  last_unit := coalesce(last_unit, product_unit, 'un');
  SELECT * INTO b FROM public.label_stock_to_base(1, last_unit);

  RETURN jsonb_build_object(
    'found', true,
    'product_id', resolved_product_id,
    'product_name', rec.product_name,
    'balance_base', bal,
    'base', b.base,
    'entry_unit', last_unit
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.label_register_usage(
  _code text,
  _quantity numeric,
  _unit text,
  _reason text DEFAULT 'use'::text,
  _employee_id uuid DEFAULT NULL::uuid,
  _notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
  resolved_product_id uuid;
  b record;
  bal numeric;
  ev text;
BEGIN
  IF coalesce(_quantity, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_quantity');
  END IF;

  SELECT * INTO rec
  FROM public.label_issuances
  WHERE unique_code = upper(trim(_code))
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  resolved_product_id := rec.label_product_id;

  IF resolved_product_id IS NULL THEN
    SELECT p.id INTO resolved_product_id
    FROM public.label_products p
    WHERE p.restaurant_id = rec.restaurant_id
      AND lower(trim(p.name)) = lower(trim(rec.product_name))
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF resolved_product_id IS NOT NULL THEN
      UPDATE public.label_issuances
      SET label_product_id = resolved_product_id
      WHERE id = rec.id;
    END IF;
  END IF;

  IF resolved_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'label_without_product');
  END IF;

  SELECT * INTO b FROM public.label_stock_to_base(_quantity, _unit);
  bal := public.label_product_balance(rec.restaurant_id, resolved_product_id);

  IF b.value > bal + 0.0000001 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_stock',
      'balance_base', bal,
      'base', b.base
    );
  END IF;

  ev := CASE lower(coalesce(_reason, 'use'))
          WHEN 'use' THEN 'discharge'
          WHEN 'consumo' THEN 'discharge'
          ELSE 'waste'
        END;

  INSERT INTO public.label_stock_movements
    (restaurant_id, event_type, product_id, issuance_id, receipt_id, quantity, unit, employee_id, user_id, notes)
  VALUES
    (rec.restaurant_id, ev, resolved_product_id, rec.id, NULL, _quantity,
     lower(coalesce(nullif(trim(_unit), ''), 'un')), _employee_id, auth.uid(), _notes);

  RETURN jsonb_build_object(
    'success', true,
    'base', b.base,
    'balance_before_base', bal,
    'balance_after_base', greatest(bal - b.value, 0),
    'product_id', resolved_product_id,
    'product_name', rec.product_name
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.label_balance_by_code(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.label_register_usage(text, numeric, text, text, uuid, text) TO anon, authenticated, service_role;
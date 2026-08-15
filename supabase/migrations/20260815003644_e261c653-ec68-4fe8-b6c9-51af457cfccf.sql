CREATE OR REPLACE FUNCTION public.label_balance_by_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  bal numeric;
  b record;
  last_unit text;
BEGIN
  SELECT * INTO rec FROM public.label_issuances WHERE unique_code = upper(_code) LIMIT 1;
  IF NOT FOUND OR rec.label_product_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  bal := public.label_product_balance(rec.restaurant_id, rec.label_product_id);

  SELECT lower(coalesce(m.unit, 'un')) INTO last_unit
  FROM public.label_stock_movements m
  WHERE m.restaurant_id = rec.restaurant_id
    AND m.product_id = rec.label_product_id
    AND m.event_type IN ('receipt','production','transfer','adjustment')
  ORDER BY m.occurred_at DESC
  LIMIT 1;

  SELECT * INTO b FROM public.label_stock_to_base(1, coalesce(last_unit, 'un'));

  RETURN jsonb_build_object(
    'found', true,
    'product_id', rec.label_product_id,
    'product_name', rec.product_name,
    'balance_base', bal,
    'base', b.base,
    'entry_unit', coalesce(last_unit, 'un')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.label_balance_by_code(text) TO anon, authenticated, service_role;
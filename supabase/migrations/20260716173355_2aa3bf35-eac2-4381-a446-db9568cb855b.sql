
ALTER TABLE public.label_issuances
  ADD COLUMN IF NOT EXISTS sif text,
  ADD COLUMN IF NOT EXISTS storage_location text;

ALTER TABLE public.label_products
  ADD COLUMN IF NOT EXISTS sif text;

CREATE OR REPLACE FUNCTION public.label_process_ready_items(_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant uuid;
  v_supplier uuid;
  v_labels_created int := 0;
  v_movements_created int := 0;
BEGIN
  SELECT restaurant_id, supplier_id INTO v_restaurant, v_supplier
  FROM public.label_receipts WHERE id = _receipt_id;

  IF v_restaurant IS NULL THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;
  IF NOT public.is_member_or_admin(v_restaurant) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.label_stock_movements
    (restaurant_id, event_type, product_id, supplier_id, receipt_id, quantity, unit, notes)
  SELECT v_restaurant, 'receipt', i.product_id, v_supplier, _receipt_id,
         i.quantity, i.unit, 'Recebimento — ' || i.raw_name
  FROM public.label_receipt_items i
  WHERE i.receipt_id = _receipt_id
    AND i.product_id IS NOT NULL
    AND COALESCE(i.needs_info, false) = false
    AND COALESCE(i.labels_prepared, 0) = 0;
  GET DIAGNOSTICS v_movements_created = ROW_COUNT;

  IF v_supplier IS NOT NULL THEN
    UPDATE public.label_products p
       SET default_supplier_id = v_supplier
      FROM public.label_receipt_items i
     WHERE i.receipt_id = _receipt_id
       AND i.product_id = p.id
       AND p.default_supplier_id IS NULL;
  END IF;

  WITH matched AS (
    SELECT i.id AS item_id, i.product_id, i.quantity, i.unit, i.raw_name,
           p.name, COALESCE(p.validity_days, 3) AS validity_days,
           p.conservation_method, p.allergens, p.ingredients, p.cif, p.sif,
           p.storage_location
    FROM public.label_receipt_items i
    JOIN public.label_products p ON p.id = i.product_id
    WHERE i.receipt_id = _receipt_id
      AND COALESCE(i.needs_info, false) = false
      AND COALESCE(i.labels_prepared, 0) = 0
  ),
  ins AS (
    INSERT INTO public.label_issuances
      (restaurant_id, label_product_id, product_name, manufacture_date, expiry_date,
       quantity, conservation_method, notes, allergens, ingredients, cif, sif, storage_location)
    SELECT v_restaurant, m.product_id, COALESCE(m.name, m.raw_name),
           now(), now() + (m.validity_days || ' days')::interval,
           COALESCE(m.quantity, 1), m.conservation_method,
           'Gerada pelo recebimento',
           m.allergens, m.ingredients, m.cif, m.sif, m.storage_location
    FROM matched m
    RETURNING id, label_product_id, quantity
  ),
  movs AS (
    INSERT INTO public.label_stock_movements
      (restaurant_id, event_type, product_id, issuance_id, receipt_id, quantity, notes)
    SELECT v_restaurant, 'label_issued', ins.label_product_id, ins.id, _receipt_id,
           ins.quantity, 'Etiqueta gerada por recebimento'
    FROM ins
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_labels_created FROM ins;

  UPDATE public.label_receipt_items
     SET labels_prepared = GREATEST(COALESCE(labels_prepared, 0), 1)
   WHERE receipt_id = _receipt_id
     AND product_id IS NOT NULL
     AND COALESCE(needs_info, false) = false;

  UPDATE public.label_receipts
     SET status = CASE
       WHEN EXISTS (
         SELECT 1 FROM public.label_receipt_items
         WHERE receipt_id = _receipt_id AND COALESCE(needs_info, false) = true
       ) THEN 'pending_info'
       ELSE 'confirmed'
     END
   WHERE id = _receipt_id;

  RETURN jsonb_build_object(
    'ok', true,
    'labels_created', v_labels_created,
    'movements_created', v_movements_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.label_process_ready_items(uuid) TO authenticated;

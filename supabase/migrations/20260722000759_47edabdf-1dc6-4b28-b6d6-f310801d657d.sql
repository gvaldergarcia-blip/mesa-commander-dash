
-- 1) Coluna receipt_id em label_issuances
ALTER TABLE public.label_issuances
  ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES public.label_receipts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_label_issuances_receipt_id
  ON public.label_issuances(receipt_id);

-- 2) Coluna printed_labels em label_issuances
ALTER TABLE public.label_issuances
  ADD COLUMN IF NOT EXISTS printed_labels integer NOT NULL DEFAULT 0;

-- 3) Preencher retroativamente receipt_id a partir de label_stock_movements
UPDATE public.label_issuances li
   SET receipt_id = m.receipt_id
  FROM public.label_stock_movements m
 WHERE m.issuance_id = li.id
   AND m.event_type = 'label_issued'
   AND m.receipt_id IS NOT NULL
   AND li.receipt_id IS NULL;

-- 4) Atualiza a RPC label_process_ready_items para gravar receipt_id nas issuances
CREATE OR REPLACE FUNCTION public.label_process_ready_items(_receipt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant uuid;
  v_supplier uuid;
  v_labels_created int := 0;
  v_movements_created int := 0;
  v_restock_resolved int := 0;
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
           i.weight, i.weight_unit,
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
       quantity, conservation_method, notes, allergens, ingredients, cif, sif, storage_location,
       weight, weight_unit, receipt_id)
    SELECT v_restaurant, m.product_id, COALESCE(m.name, m.raw_name),
           now(), now() + (m.validity_days || ' days')::interval,
           GREATEST(1, COALESCE(m.quantity, 1)::int), m.conservation_method,
           'Gerada pelo recebimento',
           m.allergens, m.ingredients, m.cif, m.sif, m.storage_location,
           m.weight, m.weight_unit, _receipt_id
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

  WITH received_products AS (
    SELECT DISTINCT i.product_id
    FROM public.label_receipt_items i
    WHERE i.receipt_id = _receipt_id
      AND i.product_id IS NOT NULL
      AND COALESCE(i.needs_info, false) = false
  ),
  resolved AS (
    DELETE FROM public.product_stock_status s
    USING received_products r
    WHERE s.restaurant_id = v_restaurant
      AND s.product_id = r.product_id
      AND s.status IN ('falta','atencao')
    RETURNING s.product_id
  )
  SELECT COUNT(*) INTO v_restock_resolved FROM resolved;

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
    'movements_created', v_movements_created,
    'restock_resolved', v_restock_resolved
  );
END;
$function$;

-- 5) Nova RPC para registrar impressão parcial de várias etiquetas
CREATE OR REPLACE FUNCTION public.label_register_prints(_prints jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rec RECORD;
  v_updated int := 0;
BEGIN
  FOR v_rec IN
    SELECT (elem->>'id')::uuid AS id,
           GREATEST(1, COALESCE((elem->>'count')::int, 1)) AS cnt
    FROM jsonb_array_elements(COALESCE(_prints, '[]'::jsonb)) elem
  LOOP
    UPDATE public.label_issuances li
       SET printed_labels = LEAST(li.quantity, COALESCE(li.printed_labels,0) + v_rec.cnt),
           updated_at = now()
     WHERE li.id = v_rec.id
       AND public.is_member_or_admin(li.restaurant_id);
    IF FOUND THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'updated', v_updated);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.label_register_prints(jsonb) TO authenticated, service_role;

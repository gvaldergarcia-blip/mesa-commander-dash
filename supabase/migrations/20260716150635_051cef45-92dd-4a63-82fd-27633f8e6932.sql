
CREATE OR REPLACE FUNCTION public.label_confirm_receipt(_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant uuid;
  v_supplier uuid;
  v_status text;
  v_labels_created int := 0;
  v_movements_created int := 0;
BEGIN
  SELECT restaurant_id, supplier_id, status
    INTO v_restaurant, v_supplier, v_status
  FROM public.label_receipts
  WHERE id = _receipt_id;

  IF v_restaurant IS NULL THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;

  IF NOT public.is_member_or_admin(v_restaurant) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', true, 'already_confirmed', true);
  END IF;

  -- 1. Movimentações "receipt"
  INSERT INTO public.label_stock_movements
    (restaurant_id, event_type, product_id, supplier_id, receipt_id, quantity, unit, notes)
  SELECT
    v_restaurant, 'receipt', i.product_id, v_supplier, _receipt_id,
    i.quantity, i.unit, 'Recebimento — ' || i.raw_name
  FROM public.label_receipt_items i
  WHERE i.receipt_id = _receipt_id AND i.product_id IS NOT NULL;
  GET DIAGNOSTICS v_movements_created = ROW_COUNT;

  -- 2. Aprender fornecedor padrão
  IF v_supplier IS NOT NULL THEN
    UPDATE public.label_products p
       SET default_supplier_id = v_supplier
      FROM public.label_receipt_items i
     WHERE i.receipt_id = _receipt_id
       AND i.product_id = p.id
       AND p.default_supplier_id IS NULL;
  END IF;

  -- 3. Gerar etiquetas + movimento label_issued
  WITH matched AS (
    SELECT i.id AS item_id, i.product_id, i.quantity, i.unit, i.raw_name,
           p.name, COALESCE(p.validity_days, 3) AS validity_days, p.conservation_method
    FROM public.label_receipt_items i
    JOIN public.label_products p ON p.id = i.product_id
    WHERE i.receipt_id = _receipt_id
  ),
  ins AS (
    INSERT INTO public.label_issuances
      (restaurant_id, label_product_id, product_name, manufacture_date, expiry_date,
       quantity, conservation_method, notes)
    SELECT
      v_restaurant, m.product_id, COALESCE(m.name, m.raw_name),
      now(), now() + (m.validity_days || ' days')::interval,
      COALESCE(m.quantity, 1), m.conservation_method,
      'Gerada pelo recebimento'
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

  -- 4. Marcar como confirmado
  UPDATE public.label_receipts
     SET status = 'confirmed'
   WHERE id = _receipt_id;

  RETURN jsonb_build_object(
    'ok', true,
    'labels_created', v_labels_created,
    'movements_created', v_movements_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.label_confirm_receipt(uuid) TO authenticated;

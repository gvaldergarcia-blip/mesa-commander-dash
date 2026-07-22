
-- Finaliza um recebimento: fecha todas as pendências de impressão pendentes
-- (marca printed_labels = quantity) e move o recebimento para o histórico.
-- Assim, nada daquele fornecedor permanece na área operacional.
CREATE OR REPLACE FUNCTION public.label_finalize_receipt(_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant uuid;
  v_closed int := 0;
BEGIN
  SELECT restaurant_id INTO v_restaurant
    FROM public.label_receipts WHERE id = _receipt_id;
  IF v_restaurant IS NULL THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;
  IF NOT public.is_member_or_admin(v_restaurant) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Fecha issuances pendentes deste recebimento (marca como totalmente impressas)
  UPDATE public.label_issuances
     SET printed_labels = quantity
   WHERE receipt_id = _receipt_id
     AND COALESCE(printed_labels,0) < COALESCE(quantity,0);
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  -- Marca items ainda pendentes como não requerendo mais info
  UPDATE public.label_receipt_items
     SET needs_info = false
   WHERE receipt_id = _receipt_id
     AND needs_info = true;

  -- Move o recebimento para "confirmed" (histórico)
  UPDATE public.label_receipts
     SET status = 'confirmed'
   WHERE id = _receipt_id;

  RETURN jsonb_build_object('ok', true, 'closed_issuances', v_closed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.label_finalize_receipt(uuid) TO authenticated, service_role;

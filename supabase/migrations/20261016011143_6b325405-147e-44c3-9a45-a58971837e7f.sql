DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.label_lot_balance(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'OR (SELECT count(DISTINCT coalesce(i.supplier_lot,'''')) FROM public.label_receipt_items i WHERE i.receipt_id=m.receipt_id AND i.product_id=m.product_id)=1','OR ((SELECT count(DISTINCT coalesce(i.supplier_lot,'''')) FROM public.label_receipt_items i WHERE i.receipt_id=m.receipt_id AND i.product_id=m.product_id)=1 AND (SELECT count(DISTINCT coalesce(x.supplier_lot,x.batch,'''')) FROM public.label_issuances x WHERE x.receipt_id=m.receipt_id AND x.label_product_id=m.product_id)=1)');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.label_register_usage(text,numeric,text,text,uuid,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF b.value>bal+0.0000001 OR (lotbal>0 AND b.value>lotbal+0.0000001) THEN','IF b.value>bal+0.0000001 OR (lotbal>0 AND b.value>lotbal+0.0000001) OR (lotbal<=0 AND (rec.receipt_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.label_stock_movements m WHERE m.issuance_id IN (SELECT c.id FROM public.label_cycle_ids(rec.id) c) AND m.event_type IN (''receipt'',''transfer'',''adjustment'')))) THEN');
 EXECUTE definition;
END;
$$;
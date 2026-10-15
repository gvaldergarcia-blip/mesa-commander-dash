-- Transactional synthetic fixtures; rollback leaves no account or stock data.
BEGIN;
DO $$
DECLARE
  r uuid := gen_random_uuid(); p uuid := gen_random_uuid();
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  code_a text := 'TEST-' || gen_random_uuid()::text;
  code_b text := 'TEST-' || gen_random_uuid()::text;
  result jsonb; blocked boolean := false;
BEGIN
  INSERT INTO public.label_products(id,restaurant_id,name,validity_days,unit,auto_reprint_enabled)
  VALUES(p,r,'Synthetic stock rule test',1,'kg',false);
  INSERT INTO public.label_issuances(id,restaurant_id,label_product_id,product_name,unique_code,batch,expiry_date,original_expiry_date)
  VALUES(a,r,p,'Synthetic stock rule test',upper(code_a),'TEST-LOT-A',now()+interval '1 day',now()+interval '2 days'),
        (b,r,p,'Synthetic stock rule test',upper(code_b),'TEST-LOT-B',now()+interval '1 day',now()+interval '3 days');
  INSERT INTO public.label_stock_movements(restaurant_id,product_id,issuance_id,event_type,quantity,unit)
  VALUES(r,p,a,'receipt',64,'kg'),(r,p,b,'receipt',10,'kg');

  result := public.label_register_usage(code_a,45,'g');
  IF result->>'error' <> 'unauthorized' THEN RAISE EXCEPTION 'Unauthenticated use was not blocked'; END IF;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  result := public.label_register_usage(code_a,45,'g');
  IF NOT (result->>'success')::boolean OR public.label_product_balance(r,p)<>73955 OR public.label_lot_balance(a)<>63955 THEN
    RAISE EXCEPTION '45g usage did not debit exactly 45g: %', result;
  END IF;
  result := public.label_register_usage(code_a,1,'un');
  IF result->>'error'<>'incompatible_unit' OR public.label_product_balance(r,p)<>73955 THEN RAISE EXCEPTION 'Incompatible unit changed stock'; END IF;
  result := public.label_register_usage(code_a,65,'kg');
  IF result->>'error'<>'insufficient_stock' OR public.label_product_balance(r,p)<>73955 THEN RAISE EXCEPTION 'Over-lot usage changed stock'; END IF;

  UPDATE public.label_issuances SET original_expiry_date=now()-interval '1 day' WHERE id=a;
  BEGIN
    INSERT INTO public.label_issuances(restaurant_id,label_product_id,product_name,batch,origin_issuance_id,expiry_date,original_expiry_date)
    VALUES(r,p,'Synthetic stock rule test','TEST-LOT-A',a,now()+interval '1 day',now()+interval '3 days');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Validade original%' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Expired original was renewed before any QR/discharge'; END IF;

  result := public.discharge_label_by_code(code_a,'vencimento',NULL,NULL,1);
  IF NOT (result->>'success')::boolean OR public.label_lot_balance(a)<>0 OR public.label_product_balance(r,p)<>10000 THEN
    RAISE EXCEPTION 'Expiry must remove whole remaining lot and preserve other lot: %', result;
  END IF;
  IF (SELECT status FROM public.label_issuances WHERE id=b)<>'active' THEN RAISE EXCEPTION 'Valid unrelated lot was closed'; END IF;
  result := public.discharge_label_by_code(code_a,'vencimento',NULL,NULL,1);
  IF result->>'error'<>'already_discharged' OR public.label_product_balance(r,p)<>10000 THEN RAISE EXCEPTION 'Repeated discharge changed stock'; END IF;
END;
$$;
ROLLBACK;
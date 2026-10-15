CREATE OR REPLACE FUNCTION public.label_cycle_ids(_id uuid)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH RECURSIVE ancestors AS (
 SELECT l.id,l.origin_issuance_id FROM public.label_issuances l WHERE l.id=_id
 UNION SELECT l.id,l.origin_issuance_id FROM public.label_issuances l JOIN ancestors a ON l.id=a.origin_issuance_id
 ), root AS (SELECT l.* FROM public.label_issuances l WHERE l.id IN (SELECT a.id FROM ancestors a) ORDER BY l.created_at LIMIT 1),
 descendants AS (SELECT r.id FROM root r UNION SELECT l.id FROM public.label_issuances l JOIN descendants d ON l.origin_issuance_id=d.id)
 SELECT d.id FROM descendants d
 UNION
 SELECT l.id FROM public.label_issuances l CROSS JOIN root r
 WHERE l.restaurant_id=r.restaurant_id AND l.label_product_id IS NOT DISTINCT FROM r.label_product_id
 AND coalesce(nullif(l.origin_traceability_lot,''),nullif(l.batch,'')) IS NOT NULL
 AND coalesce(nullif(l.origin_traceability_lot,''),nullif(l.batch,''))=coalesce(nullif(r.origin_traceability_lot,''),nullif(r.batch,''));
$$;
REVOKE ALL ON FUNCTION public.label_cycle_ids(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.label_cycle_ids(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.label_lot_balance(_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH cycle AS (SELECT l.* FROM public.label_issuances l WHERE l.id IN (SELECT c.id FROM public.label_cycle_ids(_id) c))
 SELECT coalesce(sum(CASE WHEN m.event_type IN ('receipt','transfer','adjustment') THEN b.value WHEN m.event_type IN ('discharge','waste') THEN -b.value ELSE 0 END),0)
 FROM public.label_stock_movements m CROSS JOIN LATERAL public.label_stock_to_base(m.quantity,m.unit) b
 WHERE m.event_type IN ('receipt','transfer','adjustment','discharge','waste') AND (
 m.issuance_id IN (SELECT c.id FROM cycle c)
 OR (m.issuance_id IS NULL AND EXISTS (
 SELECT 1 FROM cycle c WHERE c.receipt_id=m.receipt_id AND c.restaurant_id=m.restaurant_id AND c.label_product_id=m.product_id
 AND (coalesce(m.notes,'') LIKE '%Lote '||coalesce(c.supplier_lot,c.batch)||' ·%'
 OR coalesce(m.notes,'') LIKE '%Lote '||coalesce(c.supplier_lot,c.batch)
 OR (SELECT count(DISTINCT coalesce(i.supplier_lot,'')) FROM public.label_receipt_items i WHERE i.receipt_id=m.receipt_id AND i.product_id=m.product_id)=1)
 )));
$$;
REVOKE ALL ON FUNCTION public.label_lot_balance(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.label_lot_balance(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.label_guard_original_expiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source public.label_issuances%ROWTYPE; original timestamptz;
BEGIN
 IF NEW.origin_issuance_id IS NOT NULL THEN
 SELECT * INTO source FROM public.label_issuances WHERE id=NEW.origin_issuance_id FOR UPDATE;
 IF NOT FOUND OR source.restaurant_id<>NEW.restaurant_id OR source.label_product_id IS DISTINCT FROM NEW.label_product_id THEN RAISE EXCEPTION 'Lote de origem inválido'; END IF;
 IF NOT public.is_member_or_admin(NEW.restaurant_id) AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT coalesce(min(l.original_expiry_date),(array_agg(l.expiry_date ORDER BY l.created_at))[1]) INTO original FROM public.label_issuances l WHERE l.id IN (SELECT c.id FROM public.label_cycle_ids(source.id) c);
 IF original<=now() THEN RAISE EXCEPTION 'Validade original do fabricante vencida — não é possível renovar'; END IF;
 NEW.original_expiry_date:=original;
 NEW.expiry_date:=least(NEW.expiry_date,original);
 END IF;
 IF NEW.original_expiry_date<=now() THEN RAISE EXCEPTION 'Validade original do fabricante vencida'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_label_guard_original_expiry BEFORE INSERT ON public.label_issuances FOR EACH ROW EXECUTE FUNCTION public.label_guard_original_expiry();

CREATE OR REPLACE FUNCTION public.label_register_usage(_code text,_quantity numeric,_unit text,_reason text DEFAULT 'use',_employee_id uuid DEFAULT NULL,_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rec public.label_issuances%ROWTYPE; b record; expected record; bal numeric; lotbal numeric; entryunit text; original timestamptz;
BEGIN
 IF _quantity IS NULL OR _quantity<=0 OR _quantity::text IN ('NaN','Infinity','-Infinity') THEN RETURN jsonb_build_object('success',false,'error','invalid_quantity'); END IF;
 IF lower(coalesce(_reason,'')) NOT IN ('use','consumo') THEN RETURN jsonb_build_object('success',false,'error','invalid_reason'); END IF;
 SELECT * INTO rec FROM public.label_issuances WHERE unique_code=upper(trim(_code));
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
 IF NOT public.is_member_or_admin(rec.restaurant_id) AND coalesce(auth.role(),'')<>'service_role' THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
 IF rec.label_product_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','label_without_product'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rec.restaurant_id::text||rec.label_product_id::text,0));
 SELECT * INTO rec FROM public.label_issuances WHERE id=rec.id FOR UPDATE;
 IF rec.status='discharged' THEN RETURN jsonb_build_object('success',false,'error','already_discharged'); END IF;
 SELECT min(l.original_expiry_date) INTO original FROM public.label_issuances l WHERE l.id IN (SELECT c.id FROM public.label_cycle_ids(rec.id) c);
 IF original<=now() THEN RETURN jsonb_build_object('success',false,'error','original_expired'); END IF;
 SELECT m.unit INTO entryunit FROM public.label_stock_movements m WHERE m.restaurant_id=rec.restaurant_id AND m.product_id=rec.label_product_id AND m.event_type IN ('receipt','transfer','adjustment') ORDER BY occurred_at DESC LIMIT 1;
 SELECT * INTO expected FROM public.label_stock_to_base(1,coalesce(entryunit,rec.weight_unit,'un'));
 SELECT * INTO b FROM public.label_stock_to_base(_quantity,_unit);
 IF lower(trim(coalesce(_unit,''))) NOT IN ('g','kg','ml','l','un') OR b.base<>expected.base THEN RETURN jsonb_build_object('success',false,'error','incompatible_unit'); END IF;
 bal:=public.label_product_balance(rec.restaurant_id,rec.label_product_id);
 lotbal:=public.label_lot_balance(rec.id);
 IF b.value>bal+0.0000001 OR (lotbal>0 AND b.value>lotbal+0.0000001) THEN RETURN jsonb_build_object('success',false,'error','insufficient_stock','balance_base',least(bal,CASE WHEN lotbal>0 THEN lotbal ELSE bal END),'base',b.base); END IF;
 INSERT INTO public.label_stock_movements(restaurant_id,event_type,product_id,issuance_id,quantity,unit,employee_id,user_id,notes) VALUES(rec.restaurant_id,'discharge',rec.label_product_id,rec.id,_quantity,lower(trim(_unit)),_employee_id,auth.uid(),_notes);
 IF (lotbal>0 AND lotbal-b.value<=0.0000001) OR bal-b.value<=0.0000001 THEN
 UPDATE public.label_issuances SET status='discharged',units_used=quantity,discharge_reason='use',resolved_at=now() WHERE id IN (SELECT c.id FROM public.label_cycle_ids(rec.id) c) AND status<>'discharged';
 END IF;
 RETURN jsonb_build_object('success',true,'base',b.base,'balance_before_base',bal,'balance_after_base',greatest(bal-b.value,0),'lot_balance_after_base',greatest(lotbal-b.value,0),'product_id',rec.label_product_id,'product_name',rec.product_name);
END; $$;
REVOKE ALL ON FUNCTION public.label_register_usage(text,numeric,text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.label_register_usage(text,numeric,text,text,uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.discharge_label_by_code(_code text,_reason text,_employee_id uuid DEFAULT NULL,_notes text DEFAULT NULL,_units integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rec public.label_issuances%ROWTYPE; canon text; remaining integer; amount integer; original timestamptz; lotbal numeric; bal numeric; entryunit text; b record;
BEGIN
 SELECT * INTO rec FROM public.label_issuances WHERE unique_code=upper(trim(_code));
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
 IF NOT public.is_member_or_admin(rec.restaurant_id) AND coalesce(auth.role(),'')<>'service_role' THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rec.restaurant_id::text||coalesce(rec.label_product_id::text,rec.id::text),0));
 SELECT * INTO rec FROM public.label_issuances WHERE id=rec.id FOR UPDATE;
 IF rec.status='discharged' THEN RETURN jsonb_build_object('success',false,'error','already_discharged'); END IF;
 canon:=CASE lower(_reason) WHEN 'use' THEN 'use' WHEN 'consumo' THEN 'use' WHEN 'loss' THEN 'loss' WHEN 'vencimento' THEN 'loss' WHEN 'descarte' THEN 'loss' WHEN 'error' THEN 'error' WHEN 'outro' THEN 'error' END;
 IF canon IS NULL THEN RETURN jsonb_build_object('success',false,'error','invalid_reason'); END IF;
 IF canon='use' THEN RETURN jsonb_build_object('success',false,'error','Informe a quantidade usada para registrar o consumo'); END IF;
 SELECT min(l.original_expiry_date) INTO original FROM public.label_issuances l WHERE l.id IN (SELECT c.id FROM public.label_cycle_ids(rec.id) c);
 remaining:=greatest(rec.quantity-coalesce(rec.units_used,0),0);
 amount:=greatest(least(coalesce(_units,1),remaining),1);
 IF canon='loss' AND original<=now() THEN
 IF rec.label_product_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Produto sem vínculo de estoque'); END IF;
 lotbal:=public.label_lot_balance(rec.id);
 bal:=public.label_product_balance(rec.restaurant_id,rec.label_product_id);
 IF lotbal<=0 AND bal>0 THEN RETURN jsonb_build_object('success',false,'error','Saldo do lote não identificado; confira o recebimento antes da baixa'); END IF;
 SELECT m.unit INTO entryunit FROM public.label_stock_movements m WHERE m.restaurant_id=rec.restaurant_id AND m.product_id=rec.label_product_id AND m.event_type IN ('receipt','transfer','adjustment') ORDER BY occurred_at DESC LIMIT 1;
 SELECT * INTO b FROM public.label_stock_to_base(1,coalesce(entryunit,rec.weight_unit,'un'));
 IF lotbal>0 THEN
 INSERT INTO public.label_stock_movements(restaurant_id,event_type,product_id,issuance_id,quantity,unit,employee_id,user_id,notes) VALUES(rec.restaurant_id,'waste',rec.label_product_id,rec.id,lotbal,b.base,_employee_id,auth.uid(),coalesce(_notes,'Baixa integral por validade original vencida'));
 END IF;
 INSERT INTO public.label_discharges(restaurant_id,label_id,employee_id,reason,notes,units) SELECT l.restaurant_id,l.id,_employee_id,'loss',coalesce(_notes,'Validade original vencida'),greatest(l.quantity-coalesce(l.units_used,0),0) FROM public.label_issuances l WHERE l.id IN (SELECT c.id FROM public.label_cycle_ids(rec.id) c) AND l.status<>'discharged' AND l.quantity>coalesce(l.units_used,0);
 UPDATE public.label_issuances SET status='discharged',units_used=quantity,discharge_reason='vencimento',resolved_at=now() WHERE id IN (SELECT c.id FROM public.label_cycle_ids(rec.id) c) AND status<>'discharged';
 amount:=remaining;
 ELSE
 INSERT INTO public.label_discharges(restaurant_id,label_id,employee_id,reason,notes,units) VALUES(rec.restaurant_id,rec.id,_employee_id,canon,_notes,amount);
 UPDATE public.label_issuances SET units_used=coalesce(units_used,0)+amount,status=CASE WHEN amount>=remaining THEN 'discharged' ELSE status END,discharge_reason=CASE WHEN amount>=remaining THEN _reason ELSE discharge_reason END,resolved_at=CASE WHEN amount>=remaining THEN now() ELSE resolved_at END WHERE id=rec.id;
 END IF;
 RETURN jsonb_build_object('success',true,'units_used',amount,'units_remaining',greatest(remaining-amount,0),'fully_discharged',amount>=remaining,'label_id',rec.id,'restaurant_id',rec.restaurant_id,'product_name',rec.product_name,'label_product_id',rec.label_product_id,'stock_removed_base',coalesce(lotbal,0));
END; $$;
CREATE OR REPLACE FUNCTION public.discharge_label_by_code(_code text,_reason text,_employee_id uuid DEFAULT NULL,_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.discharge_label_by_code(_code,_reason,_employee_id,_notes,1); $$;
REVOKE ALL ON FUNCTION public.discharge_label_by_code(text,text,uuid,text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.discharge_label_by_code(text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discharge_label_by_code(text,text,uuid,text,integer) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.discharge_label_by_code(text,text,uuid,text) TO authenticated,service_role;
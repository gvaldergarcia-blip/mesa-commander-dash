CREATE OR REPLACE FUNCTION public.label_balance_by_code(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE rec public.label_issuances%ROWTYPE; bal numeric; lotbal numeric; u text; b record; linked boolean;
BEGIN
 SELECT * INTO rec FROM public.label_issuances WHERE unique_code=upper(trim(_code));
 IF NOT FOUND THEN RETURN jsonb_build_object('found',false); END IF;
 IF NOT public.is_member_or_admin(rec.restaurant_id) AND coalesce(auth.role(),'')<>'service_role' THEN RETURN jsonb_build_object('found',false,'error','unauthorized'); END IF;
 IF rec.label_product_id IS NULL THEN RETURN jsonb_build_object('found',false,'error','label_without_product'); END IF;
 bal:=public.label_product_balance(rec.restaurant_id,rec.label_product_id);
 lotbal:=public.label_lot_balance(rec.id);
 SELECT exists(SELECT 1 FROM public.label_issuances l WHERE l.id IN (SELECT c.id FROM public.label_cycle_ids(rec.id) c) AND l.receipt_id IS NOT NULL) OR exists(SELECT 1 FROM public.label_stock_movements m WHERE m.issuance_id IN (SELECT c.id FROM public.label_cycle_ids(rec.id) c) AND m.event_type IN ('receipt','transfer','adjustment')) INTO linked;
 SELECT m.unit INTO u FROM public.label_stock_movements m WHERE m.restaurant_id=rec.restaurant_id AND m.product_id=rec.label_product_id AND m.event_type IN ('receipt','production','transfer','adjustment') ORDER BY occurred_at DESC LIMIT 1;
 IF u IS NULL THEN SELECT unit INTO u FROM public.label_products WHERE id=rec.label_product_id; END IF;
 SELECT * INTO b FROM public.label_stock_to_base(1,coalesce(u,'un'));
 RETURN jsonb_build_object('found',true,'product_id',rec.label_product_id,'product_name',rec.product_name,'balance_base',greatest(CASE WHEN linked THEN least(bal,lotbal) ELSE bal END,0),'product_balance_base',bal,'lot_balance_base',lotbal,'base',b.base,'entry_unit',coalesce(u,'un'));
END; $$;
REVOKE ALL ON FUNCTION public.label_balance_by_code(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.label_balance_by_code(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.enqueue_label_reprint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_auto boolean;
BEGIN
 IF NEW.original_expiry_date<=now() THEN RETURN NEW; END IF;
 IF NEW.status='discharged' AND OLD.status IS DISTINCT FROM 'discharged' AND NEW.label_product_id IS NOT NULL THEN
 SELECT auto_reprint_enabled INTO v_auto FROM public.label_products WHERE id=NEW.label_product_id;
 IF coalesce(v_auto,false) AND NOT EXISTS(SELECT 1 FROM public.label_reprint_queue WHERE label_product_id=NEW.label_product_id AND status='pending' AND suggested_at>now()-interval '1 hour') THEN
 INSERT INTO public.label_reprint_queue(restaurant_id,label_product_id,source_label_id,suggested_reason) VALUES(NEW.restaurant_id,NEW.label_product_id,NEW.id,'discharge');
 END IF;
 END IF;
 RETURN NEW;
END; $$;
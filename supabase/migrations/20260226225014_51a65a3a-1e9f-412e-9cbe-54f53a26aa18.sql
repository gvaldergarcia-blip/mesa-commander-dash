
-- Step 1: Add cancel_actor column
ALTER TABLE mesaclik.queue_entries ADD COLUMN IF NOT EXISTS cancel_actor TEXT;

-- Step 2: Drop old function signature (return type changed)
DROP FUNCTION IF EXISTS public.get_customer_queue_history(uuid, text, text);

-- Step 3: Recreate with cancel_actor
CREATE FUNCTION public.get_customer_queue_history(p_restaurant_id uuid, p_email text DEFAULT ''::text, p_phone text DEFAULT ''::text)
RETURNS TABLE(id uuid, name text, email text, phone text, party_size integer, status text, created_at timestamp with time zone, called_at timestamp with time zone, seated_at timestamp with time zone, canceled_at timestamp with time zone, wait_time_min integer, cancel_actor text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $function$
  SELECT 
    qe.id, qe.name, qe.email, qe.phone, qe.party_size,
    qe.status::text, qe.created_at, qe.called_at, qe.seated_at,
    qe.canceled_at, qe.wait_time_min, qe.cancel_actor
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE q.restaurant_id = p_restaurant_id
    AND ((p_email != '' AND qe.email = p_email) OR (p_phone != '' AND p_phone != '—' AND qe.phone = p_phone))
  ORDER BY qe.created_at DESC
  LIMIT 100;
$function$;

-- Step 4: Update queue status RPC to track cancel_actor
CREATE OR REPLACE FUNCTION mesaclik.update_queue_entry_status_v2(p_entry_id uuid, p_status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $function$
DECLARE
  v_entry mesaclik.queue_entries;
  v_new_status mesaclik.queue_status;
  v_restaurant_id uuid;
  v_is_restaurant_action boolean := false;
  v_cancel_actor text := null;
BEGIN
  SELECT q.restaurant_id INTO v_restaurant_id
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE qe.id = p_entry_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Queue entry not found';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM mesaclik.restaurants r WHERE r.id = v_restaurant_id AND r.owner_id = auth.uid()
    ) OR public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.restaurant_members rm WHERE rm.restaurant_id = v_restaurant_id AND rm.user_id = auth.uid()
    ) THEN
      v_is_restaurant_action := true;
    ELSE
      RAISE EXCEPTION 'Unauthorized: You do not own this restaurant';
    END IF;
  ELSE
    v_is_restaurant_action := true;
  END IF;

  v_new_status := p_status::mesaclik.queue_status;

  IF v_new_status = 'canceled' THEN
    v_cancel_actor := CASE WHEN v_is_restaurant_action THEN 'restaurant' ELSE 'customer' END;
  END IF;

  UPDATE mesaclik.queue_entries
  SET status = v_new_status, updated_at = now(),
    called_at = CASE WHEN v_new_status = 'called' THEN now() ELSE called_at END,
    seated_at = CASE WHEN v_new_status = 'seated' THEN now() ELSE seated_at END,
    canceled_at = CASE WHEN v_new_status IN ('canceled', 'no_show') THEN now() ELSE canceled_at END,
    cancel_actor = CASE WHEN v_new_status = 'canceled' THEN v_cancel_actor ELSE queue_entries.cancel_actor END
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue entry not found';
  END IF;

  RETURN json_build_object(
    'success', true,
    'customer_name', v_entry.name,
    'phone', v_entry.phone,
    'email', v_entry.email,
    'queue_id', v_entry.queue_id,
    'party_size', v_entry.party_size
  );
END;
$function$;

-- Step 5: Also update cancel_my_queue_entry to mark as customer
CREATE OR REPLACE FUNCTION public.cancel_my_queue_entry(p_restaurante_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'mesaclik'
AS $function$
DECLARE
  v_user_id uuid;
  v_entry_id uuid;
  v_queue_entry_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Cancel in public.fila_entradas
  UPDATE public.fila_entradas
  SET status = 'cancelado', canceled_at = now(), active = false
  WHERE restaurante_id = p_restaurante_id
    AND user_id = v_user_id
    AND status IN ('aguardando', 'chamado')
    AND active = true
  RETURNING id INTO v_entry_id;

  -- Also cancel in mesaclik.queue_entries if exists (mark as customer cancel)
  UPDATE mesaclik.queue_entries
  SET status = 'canceled', canceled_at = now(), updated_at = now(), cancel_actor = 'customer'
  WHERE restaurant_id = p_restaurante_id
    AND user_id = v_user_id
    AND status = 'waiting'
  RETURNING id INTO v_queue_entry_id;

  IF v_entry_id IS NULL AND v_queue_entry_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma entrada ativa para cancelar');
  END IF;

  RETURN jsonb_build_object('success', true, 'entry_id', COALESCE(v_entry_id, v_queue_entry_id), 'message', 'Entrada cancelada');
END;
$function$;

-- Step 6: Visit registration system
ALTER TABLE public.restaurant_customers ADD COLUMN IF NOT EXISTS total_manual_visits integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.customer_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  customer_id uuid NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  visit_date timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'registro_manual',
  notes text,
  registered_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view visits" ON public.customer_visits
  FOR SELECT USING (public.is_member_or_admin(restaurant_id));

CREATE POLICY "Members can insert visits" ON public.customer_visits
  FOR INSERT WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE INDEX IF NOT EXISTS idx_customer_visits_restaurant ON public.customer_visits(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customer_visits_customer ON public.customer_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_visits_date ON public.customer_visits(visit_date);

-- RPC: register_customer_visit
CREATE OR REPLACE FUNCTION public.register_customer_visit(
  p_restaurant_id uuid, p_email text,
  p_name text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_visit_date timestamp with time zone DEFAULT now(),
  p_source text DEFAULT 'registro_manual',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_visit_id uuid;
  v_sanitized_email text;
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email é obrigatório');
  END IF;
  v_sanitized_email := LOWER(TRIM(p_email));

  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- Upsert customer
  v_customer_id := public.upsert_restaurant_customer(p_restaurant_id, v_sanitized_email, p_name, p_phone, 'manual');

  -- Insert visit
  INSERT INTO public.customer_visits (restaurant_id, customer_id, visit_date, source, notes, registered_by)
  VALUES (p_restaurant_id, v_customer_id, COALESCE(p_visit_date, now()), p_source, NULLIF(TRIM(p_notes), ''), auth.uid())
  RETURNING id INTO v_visit_id;

  -- Update counters
  UPDATE public.restaurant_customers
  SET 
    total_manual_visits = total_manual_visits + 1,
    total_visits = total_queue_visits + total_reservation_visits + total_manual_visits + 1,
    last_seen_at = GREATEST(last_seen_at, COALESCE(p_visit_date, now())),
    vip = CASE WHEN (total_queue_visits + total_reservation_visits + total_manual_visits + 1) >= 10 THEN true ELSE vip END
  WHERE id = v_customer_id;

  RETURN jsonb_build_object('success', true, 'customer_id', v_customer_id, 'visit_id', v_visit_id, 'message', 'Visita registrada com sucesso');
END;
$function$;

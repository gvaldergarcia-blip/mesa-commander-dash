
-- Preferências de pratos por cliente (aprendizado da IA via chat)
CREATE TABLE public.menu_customer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES public.menu_dishes(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'ia_chat',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, dish_id)
);
CREATE INDEX ON public.menu_customer_preferences (restaurant_id, customer_id);

ALTER TABLE public.menu_customer_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read prefs" ON public.menu_customer_preferences
  FOR SELECT USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY "members write prefs" ON public.menu_customer_preferences
  FOR ALL USING (public.is_member_or_admin(restaurant_id))
  WITH CHECK (public.is_member_or_admin(restaurant_id));

-- Fila de envios agendados (campanhas de prato personalizado)
CREATE TABLE public.menu_dish_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  dish_id uuid REFERENCES public.menu_dishes(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message text NOT NULL,
  image_url text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  twilio_sid text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dish_campaigns_dispatch ON public.menu_dish_campaigns (status, scheduled_at);
CREATE INDEX idx_dish_campaigns_restaurant ON public.menu_dish_campaigns (restaurant_id, created_at DESC);

ALTER TABLE public.menu_dish_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read campaigns" ON public.menu_dish_campaigns
  FOR SELECT USING (public.is_member_or_admin(restaurant_id));
CREATE POLICY "members write campaigns" ON public.menu_dish_campaigns
  FOR ALL USING (public.is_member_or_admin(restaurant_id))
  WITH CHECK (public.is_member_or_admin(restaurant_id));

CREATE TRIGGER set_updated_at_menu_customer_preferences
  BEFORE UPDATE ON public.menu_customer_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_menu_dish_campaigns
  BEFORE UPDATE ON public.menu_dish_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: marcar prato predileto
CREATE OR REPLACE FUNCTION public.set_customer_favorite_dish(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_dish_id uuid,
  p_source text DEFAULT 'ia_chat'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_member_or_admin(p_restaurant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.menu_customer_preferences (restaurant_id, customer_id, dish_id, source, score)
  VALUES (p_restaurant_id, p_customer_id, p_dish_id, p_source, 1)
  ON CONFLICT (customer_id, dish_id) DO UPDATE
    SET score = menu_customer_preferences.score + 1,
        source = EXCLUDED.source,
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- RPC: agendar campanha
CREATE OR REPLACE FUNCTION public.schedule_dish_campaign(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_dish_id uuid,
  p_message text,
  p_image_url text,
  p_scheduled_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text; v_id uuid;
BEGIN
  IF NOT public.is_member_or_admin(p_restaurant_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT customer_phone INTO v_phone FROM public.restaurant_customers
   WHERE id = p_customer_id AND restaurant_id = p_restaurant_id;
  IF v_phone IS NULL OR length(trim(v_phone)) = 0 THEN
    RAISE EXCEPTION 'customer has no phone';
  END IF;
  INSERT INTO public.menu_dish_campaigns
    (restaurant_id, customer_id, dish_id, phone, message, image_url, scheduled_at, created_by, status)
  VALUES
    (p_restaurant_id, p_customer_id, p_dish_id, v_phone, p_message, p_image_url, p_scheduled_at, auth.uid(), 'pending')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- RPC: cancelar campanha
CREATE OR REPLACE FUNCTION public.cancel_dish_campaign(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rid uuid;
BEGIN
  SELECT restaurant_id INTO v_rid FROM public.menu_dish_campaigns WHERE id = p_id;
  IF v_rid IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF NOT public.is_member_or_admin(v_rid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.menu_dish_campaigns SET status = 'canceled', updated_at = now()
   WHERE id = p_id AND status = 'pending';
END $$;

-- Cron job para despachar campanhas a cada minuto
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

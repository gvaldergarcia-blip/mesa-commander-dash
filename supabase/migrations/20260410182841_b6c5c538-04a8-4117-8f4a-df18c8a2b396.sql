
-- =============================================
-- QR Codes table
-- =============================================
CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('fila', 'cadastro')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, type)
);

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

-- Members can manage their restaurant's QR codes
CREATE POLICY "qr_codes_tenant_select" ON public.qr_codes
  FOR SELECT TO authenticated
  USING (is_member_or_admin(restaurant_id));

CREATE POLICY "qr_codes_tenant_insert" ON public.qr_codes
  FOR INSERT TO authenticated
  WITH CHECK (is_member_or_admin(restaurant_id));

CREATE POLICY "qr_codes_tenant_update" ON public.qr_codes
  FOR UPDATE TO authenticated
  USING (is_member_or_admin(restaurant_id));

-- Public can read active QR codes (needed for public pages validation)
CREATE POLICY "qr_codes_public_read" ON public.qr_codes
  FOR SELECT TO anon
  USING (active = true);

-- =============================================
-- RPC: Get restaurant info for public QR pages
-- =============================================
CREATE OR REPLACE FUNCTION public.qr_get_restaurant_info(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_logo text;
  v_active boolean;
BEGIN
  SELECT r.name, r.image_url,
    (r.plan_status IN ('trial', 'ativo'))
  INTO v_name, v_logo, v_active
  FROM mesaclik.restaurants r
  WHERE r.id = p_restaurant_id;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  IF NOT v_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante inativo');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'name', v_name,
    'logo_url', v_logo
  );
END;
$$;

-- =============================================
-- RPC: QR Join Queue (public, no auth required)
-- =============================================
CREATE OR REPLACE FUNCTION public.qr_join_queue(
  p_restaurant_id uuid,
  p_name text,
  p_phone text,
  p_marketing_optin boolean DEFAULT false,
  p_terms_accepted boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id uuid;
  v_entry_id uuid;
  v_phone_digits text;
  v_email text;
  v_customer_id text;
  v_position integer;
BEGIN
  -- Validate restaurant is active
  IF NOT EXISTS (
    SELECT 1 FROM mesaclik.restaurants
    WHERE id = p_restaurant_id
    AND plan_status IN ('trial', 'ativo')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado ou inativo');
  END IF;

  -- Normalize phone
  v_phone_digits := regexp_replace(p_phone, '\D', '', 'g');
  v_email := v_phone_digits || '@phone.local';

  -- Upsert customer in CRM
  v_customer_id := public.upsert_restaurant_customer(
    p_restaurant_id := p_restaurant_id,
    p_email := v_email,
    p_name := p_name,
    p_phone := v_phone_digits,
    p_source := 'qr_fila',
    p_marketing_optin := p_marketing_optin,
    p_terms_accepted := p_terms_accepted
  );

  -- Get or create queue for this restaurant
  SELECT id INTO v_queue_id
  FROM mesaclik.queues
  WHERE restaurant_id = p_restaurant_id AND is_active = true
  LIMIT 1;

  IF v_queue_id IS NULL THEN
    INSERT INTO mesaclik.queues (restaurant_id, name, is_active)
    VALUES (p_restaurant_id, 'Fila Principal', true)
    RETURNING id INTO v_queue_id;
  END IF;

  -- Get next position
  SELECT COALESCE(MAX(position_number), 0) + 1 INTO v_position
  FROM mesaclik.queue_entries
  WHERE queue_id = v_queue_id AND status = 'waiting';

  -- Insert queue entry
  INSERT INTO mesaclik.queue_entries (
    queue_id, customer_name, phone, party_size,
    status, position_number, priority
  ) VALUES (
    v_queue_id, p_name, v_phone_digits, 1,
    'waiting', v_position, 'normal'
  )
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'position', v_position,
    'customer_id', v_customer_id
  );
END;
$$;

-- =============================================
-- RPC: QR Register Customer (public, no auth)
-- =============================================
CREATE OR REPLACE FUNCTION public.qr_register_customer(
  p_restaurant_id uuid,
  p_name text,
  p_phone text,
  p_marketing_optin boolean DEFAULT false,
  p_terms_accepted boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_digits text;
  v_email text;
  v_customer_id text;
BEGIN
  -- Validate restaurant is active
  IF NOT EXISTS (
    SELECT 1 FROM mesaclik.restaurants
    WHERE id = p_restaurant_id
    AND plan_status IN ('trial', 'ativo')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restaurante não encontrado ou inativo');
  END IF;

  -- Normalize phone
  v_phone_digits := regexp_replace(p_phone, '\D', '', 'g');
  v_email := v_phone_digits || '@phone.local';

  -- Upsert customer in CRM
  v_customer_id := public.upsert_restaurant_customer(
    p_restaurant_id := p_restaurant_id,
    p_email := v_email,
    p_name := p_name,
    p_phone := v_phone_digits,
    p_source := 'qr_cadastro',
    p_marketing_optin := p_marketing_optin,
    p_terms_accepted := p_terms_accepted
  );

  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id
  );
END;
$$;

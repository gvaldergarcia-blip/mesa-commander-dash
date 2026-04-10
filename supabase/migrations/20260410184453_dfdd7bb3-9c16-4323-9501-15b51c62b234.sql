
-- Add birthday column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday date;

-- Recreate qr_join_queue with new params
CREATE OR REPLACE FUNCTION public.qr_join_queue(
  p_restaurant_id uuid,
  p_name text,
  p_phone text,
  p_marketing_optin boolean DEFAULT false,
  p_terms_accepted boolean DEFAULT true,
  p_email text DEFAULT NULL,
  p_birthday date DEFAULT NULL,
  p_party_size integer DEFAULT 1
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
  
  -- Use provided email or generate from phone
  IF p_email IS NOT NULL AND p_email <> '' THEN
    v_email := lower(trim(p_email));
  ELSE
    v_email := v_phone_digits || '@phone.local';
  END IF;

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

  -- Update birthday if provided
  IF p_birthday IS NOT NULL THEN
    UPDATE public.customers SET birthday = p_birthday
    WHERE phone = v_phone_digits OR email = v_email;
  END IF;

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

  -- Insert queue entry with party_size
  INSERT INTO mesaclik.queue_entries (
    queue_id, customer_name, phone, party_size,
    status, position_number, priority
  ) VALUES (
    v_queue_id, p_name, v_phone_digits, p_party_size,
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

-- Recreate qr_register_customer with new params
CREATE OR REPLACE FUNCTION public.qr_register_customer(
  p_restaurant_id uuid,
  p_name text,
  p_phone text,
  p_marketing_optin boolean DEFAULT false,
  p_terms_accepted boolean DEFAULT true,
  p_email text DEFAULT NULL,
  p_birthday date DEFAULT NULL
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
  
  -- Use provided email or generate from phone
  IF p_email IS NOT NULL AND p_email <> '' THEN
    v_email := lower(trim(p_email));
  ELSE
    v_email := v_phone_digits || '@phone.local';
  END IF;

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

  -- Update birthday if provided
  IF p_birthday IS NOT NULL THEN
    UPDATE public.customers SET birthday = p_birthday
    WHERE phone = v_phone_digits OR email = v_email;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_id
  );
END;
$$;

-- Ensure anon can call these
GRANT EXECUTE ON FUNCTION public.qr_join_queue(uuid, text, text, boolean, boolean, text, date, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.qr_register_customer(uuid, text, text, boolean, boolean, text, date) TO anon;
GRANT EXECUTE ON FUNCTION public.qr_get_restaurant_info(uuid) TO anon;

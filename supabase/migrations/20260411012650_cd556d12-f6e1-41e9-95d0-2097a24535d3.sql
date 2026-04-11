CREATE OR REPLACE FUNCTION public.qr_join_queue(
  p_restaurant_id uuid,
  p_name text,
  p_phone text,
  p_marketing_optin boolean DEFAULT false,
  p_terms_accepted boolean DEFAULT false,
  p_party_size integer DEFAULT 1,
  p_email text DEFAULT NULL,
  p_birthday date DEFAULT NULL
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
  v_contact_email text;
  v_customer_id uuid;
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
  v_contact_email := COALESCE(p_email, v_phone_digits || '@phone.local');

  -- Upsert customer in CRM
  v_customer_id := public.upsert_restaurant_customer(
    p_restaurant_id := p_restaurant_id,
    p_email := v_contact_email,
    p_name := p_name,
    p_phone := v_phone_digits,
    p_source := 'qr_fila'::text,
    p_marketing_optin := p_marketing_optin,
    p_terms_accepted := p_terms_accepted
  );

  -- Get or create normal queue for this restaurant
  SELECT id INTO v_queue_id
  FROM mesaclik.queues
  WHERE restaurant_id = p_restaurant_id AND queue_type = 'normal'
  LIMIT 1;

  IF v_queue_id IS NULL THEN
    INSERT INTO mesaclik.queues (restaurant_id, queue_type)
    VALUES (p_restaurant_id, 'normal')
    RETURNING id INTO v_queue_id;
  END IF;

  -- Check for duplicate (same phone, still waiting)
  IF EXISTS (
    SELECT 1 FROM mesaclik.queue_entries
    WHERE queue_id = v_queue_id AND phone = v_phone_digits AND status = 'waiting'
  ) THEN
    -- Return existing entry
    SELECT id, position INTO v_entry_id, v_position
    FROM mesaclik.queue_entries
    WHERE queue_id = v_queue_id AND phone = v_phone_digits AND status = 'waiting'
    LIMIT 1;
    
    RETURN jsonb_build_object(
      'success', true,
      'entry_id', v_entry_id,
      'position', v_position,
      'customer_id', v_customer_id,
      'already_in_queue', true
    );
  END IF;

  -- Get next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
  FROM mesaclik.queue_entries
  WHERE queue_id = v_queue_id AND status = 'waiting';

  -- Insert queue entry
  INSERT INTO mesaclik.queue_entries (
    queue_id, restaurant_id, name, phone, party_size,
    status, position, profile_id
  ) VALUES (
    v_queue_id, p_restaurant_id, p_name, v_phone_digits, p_party_size,
    'waiting', v_position, NULL
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
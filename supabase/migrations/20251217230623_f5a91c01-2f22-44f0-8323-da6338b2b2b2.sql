-- Fix: mesaclik.queue_entries uses column "name" (not "customer_name"), which was breaking the "Sentar" update via trigger
CREATE OR REPLACE FUNCTION public.upsert_customer_on_queue_seated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, mesaclik, extensions
AS $$
DECLARE
  v_customer_id uuid;
  v_customer_name text;
  v_phone text;
BEGIN
  -- Only process when status changes to 'seated'
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    -- Get customer name and phone from the queue entry in mesaclik schema
    SELECT qe.name, qe.phone
      INTO v_customer_name, v_phone
    FROM mesaclik.queue_entries qe
    WHERE qe.id = NEW.id;

    -- Skip if no phone number
    IF v_phone IS NULL OR v_phone = '' THEN
      RETURN NEW;
    END IF;

    -- Try to find existing customer by phone
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = v_phone
    LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
      -- Update existing customer
      UPDATE public.customers
      SET
        queue_completed = queue_completed + 1,
        total_visits = total_visits + 1,
        last_visit_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE id = v_customer_id;
    ELSE
      -- Create new customer
      INSERT INTO public.customers (
        name,
        phone,
        queue_completed,
        total_visits,
        first_visit_at,
        last_visit_date
      )
      VALUES (
        COALESCE(NULLIF(v_customer_name, ''), 'Cliente'),
        v_phone,
        1,
        1,
        NOW(),
        CURRENT_DATE
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
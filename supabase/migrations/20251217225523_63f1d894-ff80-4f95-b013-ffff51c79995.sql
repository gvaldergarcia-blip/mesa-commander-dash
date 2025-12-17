-- Fix the trigger function that upserts customers when queue entry is seated
CREATE OR REPLACE FUNCTION public.upsert_customer_on_queue_seated()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
  v_customer_name text;
  v_phone text;
BEGIN
  -- Only process when status changes to 'seated'
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    -- Get customer name and phone from the queue entry in mesaclik schema
    SELECT qe.customer_name, qe.phone 
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
      INSERT INTO public.customers (name, phone, queue_completed, total_visits, first_visit_at, last_visit_date)
      VALUES (COALESCE(v_customer_name, 'Cliente'), v_phone, 1, 1, NOW(), CURRENT_DATE);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, mesaclik;

-- Drop and recreate the trigger to ensure it's on the correct table
DROP TRIGGER IF EXISTS trigger_upsert_customer_on_queue_seated ON mesaclik.queue_entries;

CREATE TRIGGER trigger_upsert_customer_on_queue_seated
AFTER UPDATE ON mesaclik.queue_entries
FOR EACH ROW
EXECUTE FUNCTION public.upsert_customer_on_queue_seated();
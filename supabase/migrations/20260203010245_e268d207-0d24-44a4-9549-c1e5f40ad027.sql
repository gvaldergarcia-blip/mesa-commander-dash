-- Fix: queue_entries.status is mesaclik.queue_status (not public.queue_status)
-- This was causing 42804: "column status is of type mesaclik.queue_status but expression is of type queue_status"

CREATE OR REPLACE FUNCTION mesaclik.update_queue_entry_status_v2(p_entry_id uuid, p_status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO mesaclik, public
AS $function$
DECLARE
  v_entry mesaclik.queue_entries;
  v_new_status mesaclik.queue_status;
  v_restaurant_id uuid;
BEGIN
  -- Get restaurant_id for potential ownership check
  SELECT q.restaurant_id INTO v_restaurant_id
  FROM mesaclik.queue_entries qe
  JOIN mesaclik.queues q ON q.id = qe.queue_id
  WHERE qe.id = p_entry_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Queue entry not found';
  END IF;

  -- If authenticated, enforce ownership; if anon (panel without auth), allow.
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM mesaclik.restaurants r
      WHERE r.id = v_restaurant_id
        AND r.owner_id = auth.uid()
    ) AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: You do not own this restaurant';
    END IF;
  END IF;

  -- Cast status to the correct enum type
  v_new_status := p_status::mesaclik.queue_status;

  -- Update entry
  UPDATE mesaclik.queue_entries
  SET
    status = v_new_status,
    updated_at = now(),
    called_at = CASE WHEN v_new_status = 'called' THEN now() ELSE called_at END,
    seated_at = CASE WHEN v_new_status = 'seated' THEN now() ELSE seated_at END,
    canceled_at = CASE WHEN v_new_status IN ('canceled', 'no_show') THEN now() ELSE canceled_at END
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

-- Ensure permissions
GRANT USAGE ON SCHEMA mesaclik TO anon;
GRANT USAGE ON SCHEMA mesaclik TO authenticated;
GRANT EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION mesaclik.update_queue_entry_status_v2(uuid, text) TO authenticated;

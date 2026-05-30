ALTER TABLE public.label_employees
  ADD COLUMN IF NOT EXISTS sectors text[] NOT NULL DEFAULT '{}';

DROP FUNCTION IF EXISTS public.verify_employee_pin(uuid, text);

CREATE OR REPLACE FUNCTION public.verify_employee_pin(p_restaurant_id uuid, p_pin text)
RETURNS TABLE(id uuid, name text, role text, sectors text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT le.id, le.name, le.role, COALESCE(le.sectors, '{}'::text[]) AS sectors
  FROM public.label_employees le
  WHERE le.restaurant_id = p_restaurant_id
    AND le.pin = p_pin
    AND le.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_employee_pin(uuid, text) TO authenticated, anon;
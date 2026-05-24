-- PIN único por restaurante (permite NULL pra quem não tem PIN)
CREATE UNIQUE INDEX IF NOT EXISTS label_employees_restaurant_pin_uidx
  ON public.label_employees (restaurant_id, pin)
  WHERE pin IS NOT NULL;

-- RPC: validar PIN e retornar o funcionário (SECURITY DEFINER pra contornar RLS de modo kiosk)
CREATE OR REPLACE FUNCTION public.verify_employee_pin(p_restaurant_id uuid, p_pin text)
RETURNS TABLE(id uuid, name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT le.id, le.name, le.role
  FROM public.label_employees le
  WHERE le.restaurant_id = p_restaurant_id
    AND le.pin = p_pin
    AND le.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_employee_pin(uuid, text) TO authenticated, anon;
-- RPC para buscar calendário de disponibilidade do restaurante
CREATE OR REPLACE FUNCTION public.get_restaurant_calendar(p_restaurant_id UUID)
RETURNS TABLE (
  restaurant_id UUID,
  day DATE,
  is_open BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.restaurant_id,
    rc.day,
    rc.is_open,
    rc.created_at,
    rc.updated_at
  FROM mesaclik.restaurant_calendar rc
  WHERE rc.restaurant_id = p_restaurant_id
  ORDER BY rc.day ASC;
END;
$$;

-- RPC para toggle de disponibilidade de dia no calendário
CREATE OR REPLACE FUNCTION public.toggle_restaurant_calendar_day(
  p_restaurant_id UUID,
  p_day DATE,
  p_is_open BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validar que o restaurante existe
  IF NOT EXISTS (SELECT 1 FROM mesaclik.restaurants WHERE id = p_restaurant_id) THEN
    RETURN json_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- Upsert no calendário
  INSERT INTO mesaclik.restaurant_calendar (restaurant_id, day, is_open, updated_at)
  VALUES (p_restaurant_id, p_day, p_is_open, now())
  ON CONFLICT (restaurant_id, day)
  DO UPDATE SET is_open = p_is_open, updated_at = now();

  RETURN json_build_object(
    'success', true,
    'day', p_day,
    'is_open', p_is_open
  );
END;
$$;

-- Garantir permissões para anon/authenticated
GRANT EXECUTE ON FUNCTION public.get_restaurant_calendar(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_restaurant_calendar_day(UUID, DATE, BOOLEAN) TO anon, authenticated;
-- RPC para atualizar status de reserva (bypass RLS) no painel
CREATE OR REPLACE FUNCTION public.update_reservation_status_panel(
  p_reservation_id UUID,
  p_status mesaclik.reservation_status,
  p_cancel_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
DECLARE
  v_row mesaclik.reservations;
BEGIN
  IF p_reservation_id IS NULL THEN
    RAISE EXCEPTION 'reservation_id is required' USING errcode = '22023';
  END IF;

  -- Verificar se a reserva existe
  IF NOT EXISTS (SELECT 1 FROM mesaclik.reservations WHERE id = p_reservation_id) THEN
    RAISE EXCEPTION 'reservation not found' USING errcode = '22023';
  END IF;

  -- Atualizar reserva com timestamps apropriados
  UPDATE mesaclik.reservations
  SET 
    status = p_status,
    updated_at = NOW(),
    confirmed_at = CASE WHEN p_status = 'confirmed' THEN NOW() ELSE confirmed_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    canceled_at = CASE WHEN p_status = 'canceled' THEN NOW() ELSE canceled_at END,
    no_show_at = CASE WHEN p_status = 'no_show' THEN NOW() ELSE no_show_at END,
    canceled_by = CASE WHEN p_status = 'canceled' THEN 'admin' ELSE canceled_by END,
    cancel_reason = CASE WHEN p_status = 'canceled' AND p_cancel_reason IS NOT NULL THEN p_cancel_reason ELSE cancel_reason END
  WHERE id = p_reservation_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'status', v_row.status,
    'updated_at', v_row.updated_at
  );
END;
$$;

-- Permissões para anon e authenticated
GRANT EXECUTE ON FUNCTION public.update_reservation_status_panel(UUID, mesaclik.reservation_status, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.update_reservation_status_panel(UUID, mesaclik.reservation_status, TEXT) TO authenticated;
-- Drop e recriar a view de reservas com todos os campos necessários
DROP VIEW IF EXISTS mesaclik.v_reservations CASCADE;

CREATE OR REPLACE VIEW mesaclik.v_reservations AS
SELECT 
  r.id                AS reservation_id,
  r.restaurant_id,
  r.user_id,
  r.name              AS customer_name,
  r.phone,
  r.party_size        AS people,
  r.reserved_for      AS starts_at,
  r.status,
  r.notes,
  r.created_at,
  r.updated_at,
  r.confirmed_at,
  r.completed_at,
  r.canceled_at,
  r.no_show_at,
  r.canceled_by,
  r.cancel_reason,
  p.email             AS customer_email
FROM mesaclik.reservations r
LEFT JOIN public.profiles p ON p.id = r.user_id;

-- Comentário explicativo
COMMENT ON VIEW mesaclik.v_reservations IS 
'View unificada de reservas com dados do cliente. 
Campos: reservation_id, restaurant_id, customer_name, phone, people, starts_at (reserved_for), 
status, customer_email (do profiles), timestamps de confirmação/cancelamento/conclusão.';

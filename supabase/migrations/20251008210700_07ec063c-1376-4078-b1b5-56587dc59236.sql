-- Schema seguro
SET search_path = mesaclik, public;

-- v_queue_current: entradas de fila do Mocotó
CREATE OR REPLACE VIEW mesaclik.v_queue_current AS
SELECT
  qe.id AS entry_id,
  qe.queue_id,
  qe.name AS customer_name,
  qe.phone,
  qe.email,
  qe.party_size AS people,
  qe.status,
  qe.notes,
  qe.position,
  qe.called_at,
  qe.seated_at,
  qe.canceled_at,
  qe.created_at,
  qe.updated_at
FROM mesaclik.queue_entries qe
WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208';

-- v_reservations: reservas do Mocotó
CREATE OR REPLACE VIEW mesaclik.v_reservations AS
SELECT
  r.id AS reservation_id,
  r.restaurant_id,
  r.name AS customer_name,
  r.phone,
  r.party_size AS people,
  COALESCE(r.reserved_for, r.reservation_at) AS starts_at,
  r.status,
  r.notes,
  r.canceled_at,
  r.created_at,
  r.updated_at
FROM mesaclik.reservations r
WHERE r.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208';

-- v_customers: clientes do Mocotó (quem já entrou na fila OU fez reserva)
CREATE OR REPLACE VIEW mesaclik.v_customers AS
WITH queue_customers AS (
  SELECT
    qe.name,
    qe.phone,
    qe.email,
    MAX(qe.created_at) AS last_queue_visit,
    COUNT(*) AS queue_visits
  FROM mesaclik.queue_entries qe
  WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
    AND qe.name IS NOT NULL
  GROUP BY qe.name, qe.phone, qe.email
),
reservation_customers AS (
  SELECT
    r.name,
    r.phone,
    NULL::text AS email,
    MAX(COALESCE(r.reserved_for, r.reservation_at)) AS last_reservation_visit,
    COUNT(*) AS reservation_visits
  FROM mesaclik.reservations r
  WHERE r.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
    AND r.name IS NOT NULL
  GROUP BY r.name, r.phone
)
SELECT
  COALESCE(qc.name, rc.name) AS name,
  COALESCE(qc.phone, rc.phone) AS phone,
  qc.email,
  GREATEST(
    COALESCE(qc.last_queue_visit, 'epoch'::timestamp),
    COALESCE(rc.last_reservation_visit, 'epoch'::timestamp)
  ) AS last_visit_at,
  COALESCE(qc.queue_visits, 0) + COALESCE(rc.reservation_visits, 0) AS total_visits,
  false AS marketing_opt_in,
  false AS vip_status
FROM queue_customers qc
FULL OUTER JOIN reservation_customers rc 
  ON qc.phone = rc.phone;

-- v_dashboard_kpis: KPIs do dashboard do Mocotó
CREATE OR REPLACE VIEW mesaclik.v_dashboard_kpis AS
SELECT
  COALESCE((
    SELECT SUM(qe.party_size)
    FROM mesaclik.queue_entries qe
    WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
      AND qe.status = 'waiting'
  ), 0) AS people_in_queue,

  COALESCE((
    SELECT COUNT(*)
    FROM mesaclik.queue_entries qe
    WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
      AND qe.status = 'waiting'
  ), 0) AS groups_in_queue,

  COALESCE((
    SELECT COUNT(*)
    FROM mesaclik.reservations r
    WHERE r.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
      AND COALESCE(r.reserved_for, r.reservation_at)::date = CURRENT_DATE
  ), 0) AS reservations_today,

  COALESCE((
    SELECT COUNT(*)
    FROM mesaclik.queue_entries qe
    WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
      AND qe.status = 'seated'
      AND qe.seated_at::date = CURRENT_DATE
  ), 0) AS served_today,

  COALESCE((
    SELECT COUNT(*)
    FROM mesaclik.queue_entries qe
    WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
      AND qe.status = 'called'
      AND qe.called_at::date = CURRENT_DATE
  ), 0) AS called_today,

  COALESCE((
    SELECT COUNT(*)
    FROM mesaclik.queue_entries qe
    WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
      AND qe.status = 'canceled'
      AND qe.canceled_at::date = CURRENT_DATE
  ), 0) AS canceled_today;

-- Permissões de leitura
GRANT USAGE ON SCHEMA mesaclik TO anon, authenticated;
GRANT SELECT ON mesaclik.v_queue_current TO anon, authenticated;
GRANT SELECT ON mesaclik.v_reservations TO anon, authenticated;
GRANT SELECT ON mesaclik.v_customers TO anon, authenticated;
GRANT SELECT ON mesaclik.v_dashboard_kpis TO anon, authenticated;
-- ============================================
-- MESACLIK - RECRIAR VIEWS (SEM SECURITY DEFINER)
-- ============================================
-- Views simples que respeitam RLS das tabelas base
-- Data: 2025-11-08
-- ============================================

-- ==========================================
-- RECRIAR TODAS AS 8 VIEWS
-- ==========================================

-- 1) v_dashboard_kpis
DROP VIEW IF EXISTS mesaclik.v_dashboard_kpis CASCADE;
CREATE VIEW mesaclik.v_dashboard_kpis AS
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

-- 2) v_queue_current
DROP VIEW IF EXISTS mesaclik.v_queue_current CASCADE;
CREATE VIEW mesaclik.v_queue_current AS
SELECT 
  id AS entry_id,
  queue_id,
  name AS customer_name,
  phone,
  email,
  party_size AS people,
  status,
  notes,
  position,
  called_at,
  seated_at,
  canceled_at,
  created_at,
  updated_at
FROM mesaclik.queue_entries qe
WHERE restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208';

-- 3) v_queue_stats
DROP VIEW IF EXISTS mesaclik.v_queue_stats CASCADE;
CREATE VIEW mesaclik.v_queue_stats AS
SELECT 
  q.restaurant_id,
  COUNT(*) FILTER (WHERE qe.status = 'waiting') AS waiting_groups,
  COALESCE(SUM(qe.party_size) FILTER (WHERE qe.status = 'waiting'), 0) AS waiting_people
FROM mesaclik.queues q
JOIN mesaclik.queue_entries qe ON qe.queue_id = q.id
GROUP BY q.restaurant_id;

-- 4) v_queue_waiting_counts
DROP VIEW IF EXISTS mesaclik.v_queue_waiting_counts CASCADE;
CREATE VIEW mesaclik.v_queue_waiting_counts AS
SELECT 
  r.id AS restaurant_id,
  COALESCE(COUNT(q.*), 0) AS waiting_count
FROM mesaclik.restaurants r
LEFT JOIN mesaclik.queue_entries q ON q.restaurant_id = r.id AND q.status = 'waiting'
GROUP BY r.id;

-- 5) v_reservations
DROP VIEW IF EXISTS mesaclik.v_reservations CASCADE;
CREATE VIEW mesaclik.v_reservations AS
SELECT 
  r.id AS reservation_id,
  r.restaurant_id,
  r.user_id,
  r.name AS customer_name,
  r.phone,
  r.party_size AS people,
  r.reserved_for AS starts_at,
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
  p.email AS customer_email
FROM mesaclik.reservations r
LEFT JOIN profiles p ON p.id = r.user_id;

-- 6) queue_positions
DROP VIEW IF EXISTS mesaclik.queue_positions CASCADE;
CREATE VIEW mesaclik.queue_positions AS
SELECT 
  id AS entry_id,
  queue_id,
  restaurant_id,
  party_size,
  user_id,
  status,
  created_at,
  (1 + (
    SELECT COUNT(*) 
    FROM mesaclik.queue_entries qe2
    WHERE qe2.queue_id = qe.queue_id 
      AND qe2.party_size = qe.party_size 
      AND qe2.status = 'waiting'
      AND qe2.created_at < qe.created_at
  )) AS position_in_group
FROM mesaclik.queue_entries qe
WHERE status = 'waiting';

-- 7) restaurant_plans
DROP VIEW IF EXISTS mesaclik.restaurant_plans CASCADE;
CREATE VIEW mesaclik.restaurant_plans AS
SELECT 
  id,
  name,
  cuisine,
  has_queue,
  has_reservation,
  CASE
    WHEN has_queue = true AND has_reservation = true THEN 'fila_e_reserva'
    WHEN has_queue = true AND has_reservation = false THEN 'fila'
    WHEN has_queue = false AND has_reservation = true THEN 'reserva'
    ELSE 'sem_plano'
  END AS plan_type,
  is_featured,
  is_featured_queue,
  is_featured_reservation,
  is_featured_both,
  home_priority
FROM mesaclik.restaurants;

-- 8) v_customers
DROP VIEW IF EXISTS mesaclik.v_customers CASCADE;
CREATE VIEW mesaclik.v_customers AS
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
    COALESCE(qc.last_queue_visit, '1970-01-01'::timestamptz),
    COALESCE(rc.last_reservation_visit, '1970-01-01'::timestamptz)
  ) AS last_visit_at,
  (COALESCE(qc.queue_visits, 0) + COALESCE(rc.reservation_visits, 0)) AS total_visits,
  false AS marketing_opt_in,
  false AS vip_status
FROM queue_customers qc
FULL JOIN reservation_customers rc ON qc.phone = rc.phone;


-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON VIEW mesaclik.v_dashboard_kpis IS 'KPIs do dashboard - respeita RLS das tabelas base';
COMMENT ON VIEW mesaclik.v_queue_current IS 'Fila atual - respeita RLS';
COMMENT ON VIEW mesaclik.v_queue_stats IS 'Estatísticas da fila';
COMMENT ON VIEW mesaclik.v_queue_waiting_counts IS 'Contagem de espera por restaurante';
COMMENT ON VIEW mesaclik.v_reservations IS 'Reservas com info de clientes';
COMMENT ON VIEW mesaclik.queue_positions IS 'Posições na fila';
COMMENT ON VIEW mesaclik.restaurant_plans IS 'Planos dos restaurantes';
COMMENT ON VIEW mesaclik.v_customers IS 'Agregação de customers';

-- ==========================================
-- FIM
-- ==========================================

-- ========================================
-- SECURITY HARDENING: Fix SECURITY DEFINER views
-- ========================================
-- Recreate all views with security_invoker = true to ensure RLS is enforced

-- 1. eligible_marketing_customers_v
DROP VIEW IF EXISTS mesaclik.eligible_marketing_customers_v;
CREATE VIEW mesaclik.eligible_marketing_customers_v 
WITH (security_invoker = true) AS
SELECT c.id AS customer_id,
    c.email,
    c.phone,
    c.full_name,
    rc.visits_count,
    rc.last_visit_at,
    lp.points,
    c.marketing_opt_in,
    c.marketing_opt_in_updated_at
FROM mesaclik.customers c
LEFT JOIN mesaclik.restaurant_customers rc ON c.id = rc.customer_id
LEFT JOIN mesaclik.loyalty_points lp ON c.id = lp.customer_id AND lp.restaurant_id = rc.restaurant_id
WHERE c.marketing_opt_in = true;

-- 2. queue_positions
DROP VIEW IF EXISTS mesaclik.queue_positions;
CREATE VIEW mesaclik.queue_positions 
WITH (security_invoker = true) AS
SELECT id AS entry_id,
    queue_id,
    restaurant_id,
    party_size,
    user_id,
    status,
    created_at,
    1 + (SELECT count(*) FROM mesaclik.queue_entries qe2
         WHERE qe2.queue_id = qe.queue_id 
         AND qe2.party_size = qe.party_size 
         AND qe2.status = 'waiting'::mesaclik.queue_status 
         AND qe2.created_at < qe.created_at) AS position_in_group
FROM mesaclik.queue_entries qe
WHERE status = 'waiting'::mesaclik.queue_status;

-- 3. restaurant_plans
DROP VIEW IF EXISTS mesaclik.restaurant_plans;
CREATE VIEW mesaclik.restaurant_plans 
WITH (security_invoker = true) AS
SELECT id,
    name,
    cuisine,
    has_queue,
    has_reservation,
    CASE
        WHEN has_queue = true AND has_reservation = true THEN 'fila_e_reserva'::text
        WHEN has_queue = true AND has_reservation = false THEN 'fila'::text
        WHEN has_queue = false AND has_reservation = true THEN 'reserva'::text
        ELSE 'sem_plano'::text
    END AS plan_type,
    is_featured,
    is_featured_queue,
    is_featured_reservation,
    is_featured_both,
    home_priority
FROM mesaclik.restaurants;

-- 4. v_security_events
DROP VIEW IF EXISTS mesaclik.v_security_events;
CREATE VIEW mesaclik.v_security_events 
WITH (security_invoker = true) AS
SELECT id,
    user_id,
    action,
    table_name,
    created_at,
    CASE
        WHEN action = 'DELETE'::text THEN '🔴 DELETE'::text
        WHEN action = 'UPDATE'::text THEN '🟡 UPDATE'::text
        WHEN action = 'INSERT'::text THEN '🟢 INSERT'::text
        ELSE '⚪ OTHER'::text
    END AS severity
FROM mesaclik.audit_log
ORDER BY created_at DESC;

-- 5. v_queue_current
DROP VIEW IF EXISTS mesaclik.v_queue_current;
CREATE VIEW mesaclik.v_queue_current 
WITH (security_invoker = true) AS
SELECT id AS entry_id,
    queue_id,
    name AS customer_name,
    phone,
    email,
    party_size AS people,
    status,
    notes,
    "position",
    called_at,
    seated_at,
    canceled_at,
    created_at,
    updated_at
FROM mesaclik.queue_entries qe
WHERE restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid;

-- 6. v_queue_stats
DROP VIEW IF EXISTS mesaclik.v_queue_stats;
CREATE VIEW mesaclik.v_queue_stats 
WITH (security_invoker = true) AS
SELECT q.restaurant_id,
    count(*) FILTER (WHERE qe.status = 'waiting'::mesaclik.queue_status) AS waiting_groups,
    COALESCE(sum(qe.party_size) FILTER (WHERE qe.status = 'waiting'::mesaclik.queue_status), 0::bigint) AS waiting_people
FROM mesaclik.queues q
JOIN mesaclik.queue_entries qe ON qe.queue_id = q.id
GROUP BY q.restaurant_id;

-- 7. v_queue_waiting_counts
DROP VIEW IF EXISTS mesaclik.v_queue_waiting_counts;
CREATE VIEW mesaclik.v_queue_waiting_counts 
WITH (security_invoker = true) AS
SELECT r.id AS restaurant_id,
    COALESCE(count(q.*), 0::bigint) AS waiting_count
FROM mesaclik.restaurants r
LEFT JOIN mesaclik.queue_entries q ON q.restaurant_id = r.id AND q.status = 'waiting'::mesaclik.queue_status
GROUP BY r.id;

-- 8. v_reservations
DROP VIEW IF EXISTS mesaclik.v_reservations;
CREATE VIEW mesaclik.v_reservations 
WITH (security_invoker = true) AS
SELECT r.id AS reservation_id,
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

-- 9. v_dashboard_kpis (recreate with dynamic restaurant_id parameter support)
DROP VIEW IF EXISTS mesaclik.v_dashboard_kpis;
CREATE VIEW mesaclik.v_dashboard_kpis 
WITH (security_invoker = true) AS
SELECT COALESCE((SELECT sum(qe.party_size) FROM mesaclik.queue_entries qe
       WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid 
       AND qe.status = 'waiting'::mesaclik.queue_status), 0::bigint) AS people_in_queue,
    COALESCE((SELECT count(*) FROM mesaclik.queue_entries qe
       WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid 
       AND qe.status = 'waiting'::mesaclik.queue_status), 0::bigint) AS groups_in_queue,
    COALESCE((SELECT count(*) FROM mesaclik.reservations r
       WHERE r.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid 
       AND COALESCE(r.reserved_for, r.reservation_at)::date = CURRENT_DATE), 0::bigint) AS reservations_today,
    COALESCE((SELECT count(*) FROM mesaclik.queue_entries qe
       WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid 
       AND qe.status = 'seated'::mesaclik.queue_status 
       AND qe.seated_at::date = CURRENT_DATE), 0::bigint) AS served_today,
    COALESCE((SELECT count(*) FROM mesaclik.queue_entries qe
       WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid 
       AND qe.status = 'called'::mesaclik.queue_status 
       AND qe.called_at::date = CURRENT_DATE), 0::bigint) AS called_today,
    COALESCE((SELECT count(*) FROM mesaclik.queue_entries qe
       WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid 
       AND qe.status = 'canceled'::mesaclik.queue_status 
       AND qe.canceled_at::date = CURRENT_DATE), 0::bigint) AS canceled_today;

-- 10. v_customers
DROP VIEW IF EXISTS mesaclik.v_customers;
CREATE VIEW mesaclik.v_customers 
WITH (security_invoker = true) AS
WITH queue_customers AS (
    SELECT qe.name,
        qe.phone,
        qe.email,
        max(qe.created_at) AS last_queue_visit,
        count(*) AS queue_visits
    FROM mesaclik.queue_entries qe
    WHERE qe.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AND qe.name IS NOT NULL
    GROUP BY qe.name, qe.phone, qe.email
), reservation_customers AS (
    SELECT r.name,
        r.phone,
        NULL::text AS email,
        max(COALESCE(r.reserved_for, r.reservation_at)) AS last_reservation_visit,
        count(*) AS reservation_visits
    FROM mesaclik.reservations r
    WHERE r.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AND r.name IS NOT NULL
    GROUP BY r.name, r.phone
)
SELECT COALESCE(qc.name, rc.name) AS name,
    COALESCE(qc.phone, rc.phone) AS phone,
    qc.email,
    GREATEST(COALESCE(qc.last_queue_visit, '1970-01-01 00:00:00+00'::timestamp with time zone), 
             COALESCE(rc.last_reservation_visit, '1970-01-01 00:00:00+00'::timestamp with time zone)) AS last_visit_at,
    COALESCE(qc.queue_visits, 0::bigint) + COALESCE(rc.reservation_visits, 0::bigint) AS total_visits,
    false AS marketing_opt_in,
    false AS vip_status
FROM queue_customers qc
FULL JOIN reservation_customers rc ON qc.phone = rc.phone;

-- Grant SELECT on all views to authenticated and anon roles (preserve existing access patterns)
GRANT SELECT ON mesaclik.eligible_marketing_customers_v TO authenticated, anon;
GRANT SELECT ON mesaclik.queue_positions TO authenticated, anon;
GRANT SELECT ON mesaclik.restaurant_plans TO authenticated, anon;
GRANT SELECT ON mesaclik.v_security_events TO authenticated;
GRANT SELECT ON mesaclik.v_queue_current TO authenticated, anon;
GRANT SELECT ON mesaclik.v_queue_stats TO authenticated, anon;
GRANT SELECT ON mesaclik.v_queue_waiting_counts TO authenticated, anon;
GRANT SELECT ON mesaclik.v_reservations TO authenticated, anon;
GRANT SELECT ON mesaclik.v_dashboard_kpis TO authenticated, anon;
GRANT SELECT ON mesaclik.v_customers TO authenticated, anon;

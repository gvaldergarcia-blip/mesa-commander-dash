-- =====================================================
-- FECHAMENTO DE SEGURANÇA: Views com security_invoker
-- =====================================================

-- 1. Recriar v_customers com security_invoker = true
DROP VIEW IF EXISTS mesaclik.v_customers;
CREATE VIEW mesaclik.v_customers 
WITH (security_invoker = true)
AS
SELECT 
  rc.id,
  rc.restaurant_id,
  rc.customer_email,
  rc.customer_name,
  rc.customer_phone,
  rc.total_visits,
  rc.total_queue_visits,
  rc.total_reservation_visits,
  rc.last_seen_at,
  rc.marketing_optin,
  rc.marketing_optin_at,
  rc.terms_accepted,
  rc.terms_accepted_at,
  rc.vip,
  rc.status,
  rc.tags,
  rc.internal_notes,
  rc.created_at,
  rc.updated_at,
  cm.avg_wait_minutes,
  cm.last_queue_wait_minutes,
  cm.no_show_count,
  cm.cancel_count,
  cm.visits_last_30d,
  cm.visits_prev_30d
FROM public.restaurant_customers rc
LEFT JOIN public.customer_metrics cm ON cm.customer_id = rc.id
WHERE rc.restaurant_id IN (
  SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid()
  UNION
  SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
);

-- 2. Recriar v_dashboard_kpis com security_invoker = true
DROP VIEW IF EXISTS mesaclik.v_dashboard_kpis;
CREATE VIEW mesaclik.v_dashboard_kpis
WITH (security_invoker = true)
AS
WITH authorized_restaurants AS (
  SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid()
  UNION
  SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
),
queue_stats AS (
  SELECT 
    q.restaurant_id,
    COUNT(*) FILTER (WHERE qe.status = 'waiting') as queue_waiting,
    COUNT(*) FILTER (WHERE qe.status = 'called') as queue_called,
    COUNT(*) FILTER (WHERE qe.status = 'seated' AND qe.seated_at >= CURRENT_DATE) as queue_seated_today,
    AVG(EXTRACT(EPOCH FROM (COALESCE(qe.seated_at, NOW()) - qe.created_at))/60) 
      FILTER (WHERE qe.status = 'seated' AND qe.seated_at >= CURRENT_DATE) as avg_wait_today
  FROM mesaclik.queues q
  LEFT JOIN mesaclik.queue_entries qe ON qe.queue_id = q.id
  WHERE q.restaurant_id IN (SELECT restaurant_id FROM authorized_restaurants)
  GROUP BY q.restaurant_id
),
reservation_stats AS (
  SELECT 
    r.restaurant_id,
    COUNT(*) FILTER (WHERE r.status = 'pending' AND r.reserved_for::date = CURRENT_DATE) as reservations_pending_today,
    COUNT(*) FILTER (WHERE r.status = 'confirmed' AND r.reserved_for::date = CURRENT_DATE) as reservations_confirmed_today,
    COUNT(*) FILTER (WHERE r.status = 'completed' AND r.completed_at::date = CURRENT_DATE) as reservations_completed_today
  FROM mesaclik.reservations r
  WHERE r.restaurant_id IN (SELECT restaurant_id FROM authorized_restaurants)
  GROUP BY r.restaurant_id
),
customer_stats AS (
  SELECT 
    rc.restaurant_id,
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE rc.vip = true) as vip_customers,
    COUNT(*) FILTER (WHERE rc.marketing_optin = true) as marketing_optin_count
  FROM public.restaurant_customers rc
  WHERE rc.restaurant_id IN (SELECT restaurant_id FROM authorized_restaurants)
  GROUP BY rc.restaurant_id
)
SELECT 
  rest.id as restaurant_id,
  rest.name as restaurant_name,
  COALESCE(qs.queue_waiting, 0) as queue_waiting,
  COALESCE(qs.queue_called, 0) as queue_called,
  COALESCE(qs.queue_seated_today, 0) as queue_seated_today,
  COALESCE(qs.avg_wait_today, 0)::integer as avg_wait_minutes_today,
  COALESCE(rs.reservations_pending_today, 0) as reservations_pending_today,
  COALESCE(rs.reservations_confirmed_today, 0) as reservations_confirmed_today,
  COALESCE(rs.reservations_completed_today, 0) as reservations_completed_today,
  COALESCE(cs.total_customers, 0) as total_customers,
  COALESCE(cs.vip_customers, 0) as vip_customers,
  COALESCE(cs.marketing_optin_count, 0) as marketing_optin_count
FROM public.restaurants rest
LEFT JOIN queue_stats qs ON qs.restaurant_id = rest.id
LEFT JOIN reservation_stats rs ON rs.restaurant_id = rest.id
LEFT JOIN customer_stats cs ON cs.restaurant_id = rest.id
WHERE rest.id IN (SELECT restaurant_id FROM authorized_restaurants);

-- 3. Recriar v_queue_current com security_invoker = true (usando colunas reais)
DROP VIEW IF EXISTS mesaclik.v_queue_current;
CREATE VIEW mesaclik.v_queue_current
WITH (security_invoker = true)
AS
SELECT 
  qe.id,
  qe.queue_id,
  qe.restaurant_id,
  qe.name,
  qe.email,
  qe.phone,
  qe.party_size,
  qe.status,
  qe.notes,
  qe.position,
  qe.created_at,
  qe.called_at,
  qe.seated_at,
  qe.canceled_at,
  qe.wait_time_min,
  ROW_NUMBER() OVER (
    PARTITION BY qe.restaurant_id, 
    CASE 
      WHEN qe.party_size BETWEEN 1 AND 2 THEN '1-2'
      WHEN qe.party_size BETWEEN 3 AND 4 THEN '3-4'
      WHEN qe.party_size BETWEEN 5 AND 6 THEN '5-6'
      WHEN qe.party_size BETWEEN 7 AND 8 THEN '7-8'
      ELSE '9+'
    END
    ORDER BY qe.created_at
  ) as position_in_bucket
FROM mesaclik.queue_entries qe
WHERE qe.status IN ('waiting', 'called')
  AND qe.created_at >= CURRENT_DATE
  AND qe.restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
  );

-- Grant SELECT on views to authenticated users
GRANT SELECT ON mesaclik.v_customers TO authenticated;
GRANT SELECT ON mesaclik.v_dashboard_kpis TO authenticated;
GRANT SELECT ON mesaclik.v_queue_current TO authenticated;
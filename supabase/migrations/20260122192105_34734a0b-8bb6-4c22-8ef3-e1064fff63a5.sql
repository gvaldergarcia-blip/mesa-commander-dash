-- Insert test customers for palpites testing
INSERT INTO restaurant_customers (restaurant_id, customer_email, customer_name, marketing_optin, total_queue_visits, total_reservation_visits, last_seen_at)
VALUES 
  ('b01b96fb-bd8c-46d6-b168-b4d11ffdd208', 'cliente.inativo@teste.com', 'Cliente Inativo', true, 5, 0, NOW() - INTERVAL '25 days'),
  ('b01b96fb-bd8c-46d6-b168-b4d11ffdd208', 'cliente.frequente@teste.com', 'Cliente Frequente Sumido', true, 8, 0, NOW() - INTERVAL '35 days'),
  ('b01b96fb-bd8c-46d6-b168-b4d11ffdd208', 'cliente.espera@teste.com', 'Cliente Longa Espera', true, 3, 0, NOW() - INTERVAL '2 days'),
  ('b01b96fb-bd8c-46d6-b168-b4d11ffdd208', 'cliente.semoptin@teste.com', 'Cliente Sem Marketing', false, 4, 0, NOW() - INTERVAL '30 days')
ON CONFLICT (restaurant_id, customer_email) DO NOTHING;

-- Insert corresponding metrics with trigger conditions
INSERT INTO customer_metrics (restaurant_id, customer_id, total_visits, visits_last_30d, visits_prev_30d, last_visit_at, last_queue_wait_minutes, no_show_count, cancel_count)
SELECT 
  rc.restaurant_id,
  rc.id,
  COALESCE(rc.total_queue_visits + rc.total_reservation_visits, 0),
  CASE 
    WHEN rc.customer_email = 'cliente.frequente@teste.com' THEN 0  -- WINBACK: was frequent, no recent visits
    WHEN rc.customer_email = 'cliente.inativo@teste.com' THEN 0   -- CHURN_RISK: inactive 25 days
    ELSE 1
  END,
  CASE 
    WHEN rc.customer_email = 'cliente.frequente@teste.com' THEN 5  -- WINBACK: had 5 visits prev month
    ELSE 0
  END,
  rc.last_seen_at,
  CASE 
    WHEN rc.customer_email = 'cliente.espera@teste.com' THEN 50  -- LONG_WAIT: waited 50 min
    ELSE NULL
  END,
  0,
  0
FROM restaurant_customers rc
WHERE rc.customer_email IN ('cliente.inativo@teste.com', 'cliente.frequente@teste.com', 'cliente.espera@teste.com', 'cliente.semoptin@teste.com')
  AND rc.restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'
ON CONFLICT DO NOTHING;
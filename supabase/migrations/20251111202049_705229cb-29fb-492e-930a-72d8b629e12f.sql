-- Fix the eligible_marketing_customers_v view with correct column names
DROP VIEW IF EXISTS mesaclik.eligible_marketing_customers_v;

CREATE OR REPLACE VIEW mesaclik.eligible_marketing_customers_v AS
SELECT 
  c.id as customer_id,
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
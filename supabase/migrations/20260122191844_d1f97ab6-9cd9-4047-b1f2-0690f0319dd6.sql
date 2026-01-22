-- Populate customer_metrics from existing restaurant_customers data
INSERT INTO customer_metrics (
  restaurant_id,
  customer_id,
  total_visits,
  visits_last_30d,
  visits_prev_30d,
  avg_wait_minutes,
  last_visit_at,
  last_queue_wait_minutes,
  no_show_count,
  cancel_count
)
SELECT 
  rc.restaurant_id,
  rc.id as customer_id,
  COALESCE(rc.total_visits, 0) as total_visits,
  -- Estimate visits_last_30d based on last_seen_at
  CASE 
    WHEN rc.last_seen_at > NOW() - INTERVAL '30 days' THEN GREATEST(1, COALESCE(rc.total_visits, 0) / 2)
    ELSE 0
  END as visits_last_30d,
  -- Estimate visits_prev_30d
  CASE 
    WHEN rc.last_seen_at > NOW() - INTERVAL '60 days' AND rc.last_seen_at <= NOW() - INTERVAL '30 days' 
    THEN GREATEST(1, COALESCE(rc.total_visits, 0) / 2)
    WHEN rc.last_seen_at > NOW() - INTERVAL '30 days' AND COALESCE(rc.total_visits, 0) > 2
    THEN COALESCE(rc.total_visits, 0) / 2
    ELSE 0
  END as visits_prev_30d,
  NULL as avg_wait_minutes,
  rc.last_seen_at as last_visit_at,
  NULL as last_queue_wait_minutes,
  0 as no_show_count,
  0 as cancel_count
FROM restaurant_customers rc
WHERE NOT EXISTS (
  SELECT 1 FROM customer_metrics cm 
  WHERE cm.customer_id = rc.id AND cm.restaurant_id = rc.restaurant_id
);

-- Update the generate_ai_palpites function to use restaurant_customers as fallback
CREATE OR REPLACE FUNCTION generate_ai_palpites(p_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_customer record;
BEGIN
  -- First, ensure customer_metrics is populated from restaurant_customers
  INSERT INTO customer_metrics (
    restaurant_id, customer_id, total_visits, visits_last_30d, visits_prev_30d,
    last_visit_at, no_show_count, cancel_count
  )
  SELECT 
    rc.restaurant_id, rc.id, COALESCE(rc.total_visits, 0),
    CASE WHEN rc.last_seen_at > NOW() - INTERVAL '30 days' THEN GREATEST(1, COALESCE(rc.total_visits, 0) / 2) ELSE 0 END,
    CASE WHEN COALESCE(rc.total_visits, 0) > 2 THEN COALESCE(rc.total_visits, 0) / 2 ELSE 0 END,
    rc.last_seen_at, 0, 0
  FROM restaurant_customers rc
  WHERE rc.restaurant_id = p_restaurant_id
    AND NOT EXISTS (
      SELECT 1 FROM customer_metrics cm 
      WHERE cm.customer_id = rc.id AND cm.restaurant_id = rc.restaurant_id
    )
  ON CONFLICT DO NOTHING;

  -- LONG_WAIT_RECOVERY: wait >= 45 min
  FOR v_customer IN
    SELECT cm.customer_id, cm.restaurant_id, cm.last_queue_wait_minutes, rc.marketing_optin
    FROM customer_metrics cm
    JOIN restaurant_customers rc ON rc.id = cm.customer_id AND rc.restaurant_id = cm.restaurant_id
    WHERE cm.restaurant_id = p_restaurant_id
      AND cm.last_queue_wait_minutes >= 45
      AND NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = cm.customer_id
          AND ap.type = 'LONG_WAIT_RECOVERY'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      )
  LOOP
    INSERT INTO ai_palpites (
      restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
    ) VALUES (
      v_customer.restaurant_id,
      v_customer.customer_id,
      'LONG_WAIT_RECOVERY',
      'Recuperar cliente após longa espera',
      'Este cliente esperou ' || v_customer.last_queue_wait_minutes || ' minutos na última visita. Considere enviar um cupom de desculpas.',
      'high',
      COALESCE(v_customer.marketing_optin, false),
      'send_promo',
      jsonb_build_object(
        'subject', 'Pedimos desculpas pela espera!',
        'message', 'Sabemos que sua última visita teve uma espera maior que o normal. Para compensar, oferecemos um desconto especial na sua próxima visita!',
        'coupon_code', 'DESCULPA15',
        'discount_percent', 15,
        'valid_days', 7
      ),
      'new'
    );
    v_count := v_count + 1;
  END LOOP;

  -- WINBACK: was frequent (visits_prev_30d >= 3) but no recent visits
  FOR v_customer IN
    SELECT cm.customer_id, cm.restaurant_id, cm.visits_prev_30d, rc.marketing_optin
    FROM customer_metrics cm
    JOIN restaurant_customers rc ON rc.id = cm.customer_id AND rc.restaurant_id = cm.restaurant_id
    WHERE cm.restaurant_id = p_restaurant_id
      AND cm.visits_prev_30d >= 3
      AND cm.visits_last_30d = 0
      AND NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = cm.customer_id
          AND ap.type = 'WINBACK'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      )
  LOOP
    INSERT INTO ai_palpites (
      restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
    ) VALUES (
      v_customer.restaurant_id,
      v_customer.customer_id,
      'WINBACK',
      'Trazer cliente frequente de volta',
      'Este cliente visitava com frequência (' || v_customer.visits_prev_30d || ' vezes no mês anterior) mas não apareceu nos últimos 30 dias.',
      'high',
      COALESCE(v_customer.marketing_optin, false),
      'send_promo',
      jsonb_build_object(
        'subject', 'Sentimos sua falta!',
        'message', 'Faz tempo que não nos visitamos! Preparamos uma oferta especial para você voltar.',
        'coupon_code', 'VOLTEJA20',
        'discount_percent', 20,
        'valid_days', 14
      ),
      'new'
    );
    v_count := v_count + 1;
  END LOOP;

  -- CHURN_RISK: last visit > 21 days and total_visits >= 2
  FOR v_customer IN
    SELECT cm.customer_id, cm.restaurant_id, cm.total_visits, cm.last_visit_at, rc.marketing_optin
    FROM customer_metrics cm
    JOIN restaurant_customers rc ON rc.id = cm.customer_id AND rc.restaurant_id = cm.restaurant_id
    WHERE cm.restaurant_id = p_restaurant_id
      AND cm.last_visit_at < NOW() - INTERVAL '21 days'
      AND cm.total_visits >= 2
      AND NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = cm.customer_id
          AND ap.type = 'CHURN_RISK'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      )
  LOOP
    INSERT INTO ai_palpites (
      restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
    ) VALUES (
      v_customer.restaurant_id,
      v_customer.customer_id,
      'CHURN_RISK',
      'Risco de perder cliente',
      'Este cliente fez ' || v_customer.total_visits || ' visitas mas não retorna há mais de 21 dias. Considere enviar um lembrete.',
      'med',
      COALESCE(v_customer.marketing_optin, false),
      'send_promo',
      jsonb_build_object(
        'subject', 'Temos novidades para você!',
        'message', 'Estamos com saudades! Venha conferir as novidades e aproveite um desconto exclusivo.',
        'coupon_code', 'VOLTEJA10',
        'discount_percent', 10,
        'valid_days', 10
      ),
      'new'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
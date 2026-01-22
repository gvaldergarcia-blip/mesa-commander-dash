
-- 1. Limpar dados mock
DELETE FROM ai_palpites WHERE restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208';
DELETE FROM customer_metrics WHERE restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208';
DELETE FROM customer_events WHERE restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208';
DELETE FROM restaurant_customers 
WHERE restaurant_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208' 
  AND customer_email LIKE '%@teste.com';

-- 2. Recriar função generate_ai_palpites para usar restaurant_customers diretamente
CREATE OR REPLACE FUNCTION generate_ai_palpites(p_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_customer record;
  v_days_since_last_visit integer;
BEGIN
  -- Analisar cada cliente REAL em restaurant_customers
  FOR v_customer IN
    SELECT 
      rc.id as customer_id,
      rc.restaurant_id,
      rc.customer_name,
      rc.customer_email,
      rc.total_visits,
      rc.total_queue_visits,
      rc.total_reservation_visits,
      rc.last_seen_at,
      rc.marketing_optin,
      rc.vip,
      EXTRACT(DAY FROM (NOW() - rc.last_seen_at))::integer as days_inactive
    FROM restaurant_customers rc
    WHERE rc.restaurant_id = p_restaurant_id
      AND rc.total_visits > 0  -- Só clientes com pelo menos 1 visita
  LOOP
    v_days_since_last_visit := v_customer.days_inactive;

    -- WINBACK: Cliente frequente (3+ visitas) que não aparece há 30+ dias
    IF v_customer.total_visits >= 3 AND v_days_since_last_visit >= 30 THEN
      -- Verifica se não existe palpite recente desse tipo
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'WINBACK'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'WINBACK',
          'Trazer cliente frequente de volta',
          'Este cliente visitou ' || v_customer.total_visits || ' vezes, mas não aparece há ' || v_days_since_last_visit || ' dias. Hora de reconquistar!',
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
        CONTINUE; -- Próximo cliente (evita múltiplos palpites para o mesmo)
      END IF;
    END IF;

    -- CHURN_RISK: Cliente com 2+ visitas inativo há 21-29 dias
    IF v_customer.total_visits >= 2 AND v_days_since_last_visit BETWEEN 21 AND 29 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'CHURN_RISK'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'CHURN_RISK',
          'Risco de perder cliente',
          'Cliente com ' || v_customer.total_visits || ' visitas não aparece há ' || v_days_since_last_visit || ' dias. Envie uma oferta antes que seja tarde!',
          'med',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Uma oferta especial para você!',
            'message', 'Preparamos um desconto exclusivo para sua próxima visita.',
            'coupon_code', 'VOLTA10',
            'discount_percent', 10,
            'valid_days', 7
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- VIP_ENGAGEMENT: Cliente VIP que não visita há 14+ dias
    IF v_customer.vip = true AND v_days_since_last_visit >= 14 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'VIP_ENGAGEMENT'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'VIP_ENGAGEMENT',
          'Manter cliente VIP engajado',
          'Seu cliente VIP ' || COALESCE(v_customer.customer_name, 'Cliente') || ' não visita há ' || v_days_since_last_visit || ' dias. Mantenha-o especial!',
          'high',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Exclusivo para você, VIP!',
            'message', 'Como cliente especial, preparamos uma surpresa exclusiva para sua próxima visita.',
            'coupon_code', 'VIP25',
            'discount_percent', 25,
            'valid_days', 14
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- NEW_CUSTOMER_FOLLOWUP: Cliente novo (1 visita) há mais de 7 dias
    IF v_customer.total_visits = 1 AND v_days_since_last_visit BETWEEN 7 AND 21 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'NEW_CUSTOMER_FOLLOWUP'
          AND ap.created_at > NOW() - INTERVAL '30 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'NEW_CUSTOMER_FOLLOWUP',
          'Incentivar segunda visita',
          'Cliente novo visitou há ' || v_days_since_last_visit || ' dias. Uma oferta pode garantir a segunda visita!',
          'med',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Que bom ter você conosco!',
            'message', 'Esperamos que sua primeira visita tenha sido especial. Volte em breve com um desconto exclusivo!',
            'coupon_code', 'BEMVINDO15',
            'discount_percent', 15,
            'valid_days', 14
          ),
          'new'
        );
        v_count := v_count + 1;
      END IF;
    END IF;

  END LOOP;

  RETURN v_count;
END;
$$;

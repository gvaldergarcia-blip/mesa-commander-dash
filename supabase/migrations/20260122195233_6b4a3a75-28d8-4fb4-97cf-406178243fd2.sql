-- Atualiza a função generate_ai_palpites com novos cenários de engajamento
CREATE OR REPLACE FUNCTION public.generate_ai_palpites(p_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    v_days_since_last_visit := COALESCE(v_customer.days_inactive, 0);

    -- ========== CENÁRIOS DE ENGAJAMENTO (clientes ativos) ==========
    
    -- 1) POST_VISIT: Cliente visitou há ~7 dias (entre 6 e 10 dias)
    -- Enviar agradecimento e pedir avaliação
    IF v_days_since_last_visit BETWEEN 6 AND 10 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'POST_VISIT'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'POST_VISIT',
          'Agradecer visita recente',
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' visitou há ' || v_days_since_last_visit || ' dias. Hora de agradecer e pedir uma avaliação!',
          'low',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Obrigado pela visita!',
            'message', 'Foi um prazer receber você! Esperamos que tenha gostado da experiência. Que tal nos contar como foi?',
            'coupon_code', NULL,
            'discount_percent', 0,
            'valid_days', 30
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE; -- Próximo cliente
      END IF;
    END IF;
    
    -- 2) FREQUENT_CUSTOMER: Cliente com 3+ visitas nos últimos 30 dias
    -- Reconhecer a frequência e oferecer benefício
    IF v_days_since_last_visit <= 30 AND v_customer.total_visits >= 3 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'FREQUENT_CUSTOMER'
          AND ap.created_at > NOW() - INTERVAL '30 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'FREQUENT_CUSTOMER',
          'Reconhecer cliente frequente',
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' já veio ' || v_customer.total_visits || ' vezes! Considere enviar uma mensagem de reconhecimento.',
          'med',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Você é especial para nós!',
            'message', 'Notamos que você já nos visitou várias vezes. Agradecemos sua preferência e preparamos algo especial!',
            'coupon_code', 'FREQUENTE10',
            'discount_percent', 10,
            'valid_days', 14
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;
    
    -- 3) ALMOST_VIP: Cliente com 8-9 visitas (perto de virar VIP = 10 visitas)
    IF v_customer.total_visits BETWEEN 8 AND 9 AND v_customer.vip = false THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'ALMOST_VIP'
          AND ap.created_at > NOW() - INTERVAL '30 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'ALMOST_VIP',
          'Cliente quase VIP!',
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' tem ' || v_customer.total_visits || ' visitas. Faltam apenas ' || (10 - v_customer.total_visits) || ' para virar VIP!',
          'high',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Você está quase lá!',
            'message', 'Falta pouco para você se tornar um cliente VIP! Na sua próxima visita, você terá benefícios exclusivos.',
            'coupon_code', 'QUASEVIP15',
            'discount_percent', 15,
            'valid_days', 21
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- ========== CENÁRIOS DE INATIVIDADE (clientes ausentes) ==========
    
    -- 4) WINBACK: Cliente frequente (3+ visitas) que não aparece há 30+ dias
    IF v_customer.total_visits >= 3 AND v_days_since_last_visit >= 30 THEN
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
        CONTINUE;
      END IF;
    END IF;

    -- 5) CHURN_RISK: Cliente com 2+ visitas inativo há 21-29 dias
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

    -- 6) VIP_ENGAGEMENT: Cliente VIP que não visita há 14+ dias
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
          'Engajar cliente VIP',
          'Cliente VIP ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' não visita há ' || v_days_since_last_visit || ' dias. Mantenha o relacionamento!',
          'high',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Oferta exclusiva VIP!',
            'message', 'Como cliente VIP, você merece tratamento especial. Preparamos algo único para você.',
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

    -- 7) NEW_CUSTOMER_FOLLOWUP: Cliente com 1 visita, entre 7 e 21 dias atrás
    IF v_customer.total_visits = 1 AND v_days_since_last_visit BETWEEN 7 AND 21 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'NEW_CUSTOMER_FOLLOWUP'
          AND ap.created_at > NOW() - INTERVAL '21 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'NEW_CUSTOMER_FOLLOWUP',
          'Incentivar segunda visita',
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' veio pela primeira vez há ' || v_days_since_last_visit || ' dias. Incentive uma segunda visita!',
          'med',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Volte e ganhe um desconto!',
            'message', 'Gostou da primeira visita? Volte e ganhe um desconto especial de boas-vindas.',
            'coupon_code', 'BEMVINDO15',
            'discount_percent', 15,
            'valid_days', 14
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

  END LOOP;

  RETURN v_count;
END;
$$;
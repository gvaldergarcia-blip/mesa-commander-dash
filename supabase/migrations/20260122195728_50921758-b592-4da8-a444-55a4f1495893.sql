-- =====================================================
-- EVOLUÇÃO PREMIUM: generate_ai_palpites v3
-- Adiciona novos cenários: LONG_WAIT, NO_SHOW_RECURRENT
-- Usa tabela customer_metrics para dados operacionais
-- =====================================================

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
  -- Analisar cada cliente REAL em restaurant_customers + métricas
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
      EXTRACT(DAY FROM (NOW() - rc.last_seen_at))::integer as days_inactive,
      -- Dados de customer_metrics (LEFT JOIN para clientes sem métricas)
      COALESCE(cm.last_queue_wait_minutes, 0) as tempo_espera_ultimo,
      COALESCE(cm.avg_wait_minutes, 0) as tempo_espera_medio,
      COALESCE(cm.no_show_count, 0) as no_show_count,
      COALESCE(cm.cancel_count, 0) as cancel_count,
      COALESCE(cm.visits_last_30d, 0) as visitas_ultimos_30_dias,
      COALESCE(cm.visits_prev_30d, 0) as visitas_30_dias_anterior
    FROM restaurant_customers rc
    LEFT JOIN customer_metrics cm ON cm.customer_id = rc.id
    WHERE rc.restaurant_id = p_restaurant_id
      AND rc.total_visits > 0  -- Só clientes com pelo menos 1 visita
  LOOP
    v_days_since_last_visit := COALESCE(v_customer.days_inactive, 0);

    -- ========== CENÁRIO 1: FILA LONGA (tempo_espera_ultimo > 45 min) ==========
    IF v_customer.tempo_espera_ultimo > 45 AND v_days_since_last_visit <= 14 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'LONG_WAIT_RECOVERY'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'LONG_WAIT_RECOVERY',
          'Compensar longa espera',
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' esperou ' || v_customer.tempo_espera_ultimo || ' minutos na última fila. Sugira um cupom de compensação.',
          'high',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Um pedido de desculpas especial!',
            'message', 'Sabemos que sua última visita teve uma espera maior que o normal. Queremos compensar você com uma oferta especial!',
            'coupon_code', 'DESCULPA15',
            'discount_percent', 15,
            'valid_days', 14
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- ========== CENÁRIO 2: NO-SHOW RECORRENTE (no_show_count >= 2) ==========
    IF v_customer.no_show_count >= 2 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'NO_SHOW_EDUCATE'
          AND ap.created_at > NOW() - INTERVAL '30 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'NO_SHOW_EDUCATE',
          'Comunicação educativa (no-shows)',
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' tem ' || v_customer.no_show_count || ' no-shows registrados. Envie comunicação gentil, sem desconto.',
          'med',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Vamos remarcar?',
            'message', 'Notamos que você não pôde comparecer às suas últimas reservas. Entendemos que imprevistos acontecem! Que tal remarcar? Aguardamos você.',
            'coupon_code', NULL,
            'discount_percent', 0,
            'valid_days', 30
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- ========== CENÁRIO 3: CLIENTE ESFRIANDO (frequente antes, sumiu agora) ==========
    IF v_customer.visitas_30_dias_anterior >= 3 AND v_customer.visitas_ultimos_30_dias = 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM ai_palpites ap
        WHERE ap.customer_id = v_customer.customer_id
          AND ap.type = 'COOLING_CUSTOMER'
          AND ap.created_at > NOW() - INTERVAL '14 days'
          AND ap.status NOT IN ('dismissed', 'sent')
      ) THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, action_allowed, cta_type, cta_payload, status
        ) VALUES (
          v_customer.restaurant_id,
          v_customer.customer_id,
          'COOLING_CUSTOMER',
          'Cliente esfriando',
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' tinha ' || v_customer.visitas_30_dias_anterior || ' visitas no mês anterior, mas sumiu neste mês. Hora de reativar!',
          'high',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Sentimos sua falta!',
            'message', 'Você era presença frequente por aqui! Estamos com saudades. Volte e aproveite uma oferta especial de retorno.',
            'coupon_code', 'VOLTAJA15',
            'discount_percent', 15,
            'valid_days', 14
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- ========== CENÁRIO 4: CLIENTE FREQUENTE (5+ visitas, reconhecer) ==========
    IF v_customer.total_visits >= 5 AND v_customer.vip = false THEN
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
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' já veio ' || v_customer.total_visits || ' vezes! Hora de oferecer um benefício VIP.',
          'med',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Você merece um tratamento especial!',
            'message', 'Reconhecemos sua fidelidade! Você já é um cliente especial para nós. Aproveite esta oferta exclusiva.',
            'coupon_code', 'FIEL10',
            'discount_percent', 10,
            'valid_days', 21
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- ========== CENÁRIO 5: POST_VISIT (visitou há 6-10 dias) ==========
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
          'Cliente ' || COALESCE(v_customer.customer_name, v_customer.customer_email) || ' visitou há ' || v_days_since_last_visit || ' dias. Hora de agradecer e pedir avaliação!',
          'low',
          COALESCE(v_customer.marketing_optin, false),
          'send_promo',
          jsonb_build_object(
            'subject', 'Obrigado pela visita!',
            'message', 'Foi um prazer receber você! Esperamos que tenha gostado. Que tal nos contar como foi sua experiência?',
            'coupon_code', NULL,
            'discount_percent', 0,
            'valid_days', 30
          ),
          'new'
        );
        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- ========== CENÁRIO 6: ALMOST_VIP (8-9 visitas, quase VIP) ==========
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

    -- ========== CENÁRIO 7: WINBACK (frequente, sumiu há 30+ dias) ==========
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

    -- ========== CENÁRIO 8: CHURN_RISK (2+ visitas, inativo 21-29 dias) ==========
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

    -- ========== CENÁRIO 9: VIP_ENGAGEMENT (VIP inativo 14+ dias) ==========
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

    -- ========== CENÁRIO 10: NEW_CUSTOMER_FOLLOWUP (1 visita, 7-21 dias atrás) ==========
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
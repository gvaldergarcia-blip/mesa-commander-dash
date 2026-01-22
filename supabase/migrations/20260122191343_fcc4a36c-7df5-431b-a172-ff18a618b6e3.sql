-- 1) Tabela customer_events: registra eventos de fila/reserva
CREATE TABLE public.customer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'queue_seated', 'queue_no_show', 'reservation_completed', 'reservation_canceled', etc.
  party_size INTEGER,
  queue_wait_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_customer_events_restaurant ON public.customer_events(restaurant_id);
CREATE INDEX idx_customer_events_customer ON public.customer_events(customer_id);
CREATE INDEX idx_customer_events_created ON public.customer_events(created_at DESC);

-- RLS
ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_events_owner_read" ON public.customer_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = customer_events.restaurant_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "customer_events_insert_all" ON public.customer_events
  FOR INSERT WITH CHECK (true);

-- 2) Tabela customer_metrics: métricas agregadas por cliente
CREATE TABLE public.customer_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  total_visits INTEGER NOT NULL DEFAULT 0,
  visits_last_30d INTEGER NOT NULL DEFAULT 0,
  visits_prev_30d INTEGER NOT NULL DEFAULT 0,
  avg_wait_minutes INTEGER,
  last_visit_at TIMESTAMPTZ,
  last_queue_wait_minutes INTEGER,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  cancel_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, customer_id)
);

-- Índices
CREATE INDEX idx_customer_metrics_restaurant ON public.customer_metrics(restaurant_id);
CREATE INDEX idx_customer_metrics_customer ON public.customer_metrics(customer_id);

-- RLS
ALTER TABLE public.customer_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_metrics_owner_read" ON public.customer_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = customer_metrics.restaurant_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "customer_metrics_upsert_all" ON public.customer_metrics
  FOR ALL USING (true) WITH CHECK (true);

-- 3) Tabela ai_palpites: palpites gerados pelo sistema
CREATE TABLE public.ai_palpites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  customer_id UUID,
  type TEXT NOT NULL, -- 'LONG_WAIT_RECOVERY', 'WINBACK', 'CHURN_RISK'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'med', -- 'low', 'med', 'high'
  action_allowed BOOLEAN NOT NULL DEFAULT false,
  cta_type TEXT, -- 'send_promo', 'send_message'
  cta_payload JSONB, -- { subject, message, coupon_code, discount_percent, valid_days }
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'seen', 'dismissed', 'sent'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_ai_palpites_restaurant ON public.ai_palpites(restaurant_id);
CREATE INDEX idx_ai_palpites_customer ON public.ai_palpites(customer_id);
CREATE INDEX idx_ai_palpites_status ON public.ai_palpites(status);
CREATE INDEX idx_ai_palpites_created ON public.ai_palpites(created_at DESC);
CREATE INDEX idx_ai_palpites_type_customer ON public.ai_palpites(type, customer_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_palpites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_palpites_owner_all" ON public.ai_palpites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = ai_palpites.restaurant_id AND r.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = ai_palpites.restaurant_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "ai_palpites_insert_system" ON public.ai_palpites
  FOR INSERT WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_ai_palpites_updated_at
  BEFORE UPDATE ON public.ai_palpites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Função para gerar palpites baseados em métricas
CREATE OR REPLACE FUNCTION public.generate_ai_palpites(p_restaurant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
  v_customer RECORD;
  v_existing UUID;
  v_action_allowed BOOLEAN;
BEGIN
  -- Loop através de clientes com métricas
  FOR v_customer IN 
    SELECT 
      cm.*,
      rc.customer_name,
      rc.customer_email,
      rc.marketing_optin
    FROM customer_metrics cm
    JOIN restaurant_customers rc ON rc.id = cm.customer_id AND rc.restaurant_id = cm.restaurant_id
    WHERE cm.restaurant_id = p_restaurant_id
  LOOP
    v_action_allowed := COALESCE(v_customer.marketing_optin, false);
    
    -- LONG_WAIT_RECOVERY: espera >= 45 min na última visita
    IF v_customer.last_queue_wait_minutes >= 45 THEN
      -- Verificar se já existe palpite recente
      SELECT id INTO v_existing FROM ai_palpites 
      WHERE customer_id = v_customer.customer_id 
        AND type = 'LONG_WAIT_RECOVERY'
        AND created_at > now() - interval '14 days'
        AND status NOT IN ('dismissed', 'sent')
      LIMIT 1;
      
      IF v_existing IS NULL THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, 
          action_allowed, cta_type, cta_payload
        ) VALUES (
          p_restaurant_id,
          v_customer.customer_id,
          'LONG_WAIT_RECOVERY',
          'Recuperar cliente após longa espera',
          format('Cliente %s esperou %s minutos na última visita. Envie um cupom de desculpas.', 
            COALESCE(v_customer.customer_name, v_customer.customer_email), 
            v_customer.last_queue_wait_minutes),
          'high',
          v_action_allowed,
          'send_promo',
          jsonb_build_object(
            'subject', 'Pedimos desculpas pela espera!',
            'message', format('Olá %s! Sabemos que sua última visita teve uma espera maior que o esperado. Para compensar, preparamos um desconto especial para você.', COALESCE(v_customer.customer_name, 'Cliente')),
            'coupon_code', 'DESCULPA15',
            'discount_percent', 15,
            'valid_days', 7
          )
        );
        v_count := v_count + 1;
      END IF;
    END IF;
    
    -- WINBACK: visitou 3+ vezes no mês passado, 0 este mês
    IF v_customer.visits_prev_30d >= 3 AND v_customer.visits_last_30d = 0 THEN
      SELECT id INTO v_existing FROM ai_palpites 
      WHERE customer_id = v_customer.customer_id 
        AND type = 'WINBACK'
        AND created_at > now() - interval '14 days'
        AND status NOT IN ('dismissed', 'sent')
      LIMIT 1;
      
      IF v_existing IS NULL THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, 
          action_allowed, cta_type, cta_payload
        ) VALUES (
          p_restaurant_id,
          v_customer.customer_id,
          'WINBACK',
          'Cliente frequente sumiu',
          format('Cliente %s visitava %s vezes/mês e parou de vir. Hora de reconquistar!', 
            COALESCE(v_customer.customer_name, v_customer.customer_email), 
            v_customer.visits_prev_30d),
          'high',
          v_action_allowed,
          'send_promo',
          jsonb_build_object(
            'subject', 'Sentimos sua falta!',
            'message', format('Olá %s! Faz um tempo que você não nos visita. Preparamos algo especial para você voltar.', COALESCE(v_customer.customer_name, 'Cliente')),
            'coupon_code', 'VOLTEJA20',
            'discount_percent', 20,
            'valid_days', 14
          )
        );
        v_count := v_count + 1;
      END IF;
    END IF;
    
    -- CHURN_RISK: última visita > 21 dias e tem histórico
    IF v_customer.last_visit_at < now() - interval '21 days' AND v_customer.total_visits >= 2 THEN
      SELECT id INTO v_existing FROM ai_palpites 
      WHERE customer_id = v_customer.customer_id 
        AND type = 'CHURN_RISK'
        AND created_at > now() - interval '14 days'
        AND status NOT IN ('dismissed', 'sent')
      LIMIT 1;
      
      IF v_existing IS NULL THEN
        INSERT INTO ai_palpites (
          restaurant_id, customer_id, type, title, message, priority, 
          action_allowed, cta_type, cta_payload
        ) VALUES (
          p_restaurant_id,
          v_customer.customer_id,
          'CHURN_RISK',
          'Risco de perder cliente',
          format('Cliente %s não visita há %s dias. Total de %s visitas anteriores.', 
            COALESCE(v_customer.customer_name, v_customer.customer_email), 
            EXTRACT(DAY FROM now() - v_customer.last_visit_at)::integer,
            v_customer.total_visits),
          'med',
          v_action_allowed,
          'send_promo',
          jsonb_build_object(
            'subject', 'Temos novidades para você!',
            'message', format('Olá %s! Faz um tempinho que você não aparece. Que tal nos visitar novamente?', COALESCE(v_customer.customer_name, 'Cliente')),
            'coupon_code', 'VOLTESEMPRE10',
            'discount_percent', 10,
            'valid_days', 7
          )
        );
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;
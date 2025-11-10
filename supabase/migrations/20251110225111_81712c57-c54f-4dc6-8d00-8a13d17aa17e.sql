-- ============================================================================
-- MIGRAÇÃO: Sistema Completo de Promoções & Marketing + 10 Cliks (FINAL)
-- ============================================================================

-- 1) Ajustar tabela customers - adicionar todas as colunas necessárias
-- ============================================================================
DO $$ 
BEGIN
  -- Adicionar colunas se não existirem
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'customers' AND column_name = 'marketing_opt_in') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'customers' AND column_name = 'marketing_opt_in_updated_at') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN marketing_opt_in_updated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'customers' AND column_name = 'vip_status') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN vip_status boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'customers' AND column_name = 'notes') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'customers' AND column_name = 'last_visit_date') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN last_visit_date timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'customers' AND column_name = 'total_visits') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN total_visits integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'customers' AND column_name = 'total_spent') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN total_spent numeric NOT NULL DEFAULT 0.00;
  END IF;
END $$;

-- Criar índice para consultas de opt-in
CREATE INDEX IF NOT EXISTS idx_customers_marketing_opt_in 
ON mesaclik.customers(marketing_opt_in) WHERE marketing_opt_in = true;

-- 2) Tabela de relação Cliente x Restaurante (visitas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesaclik.restaurant_customers (
  restaurant_id uuid NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES mesaclik.customers(id) ON DELETE CASCADE,
  visits_count integer NOT NULL DEFAULT 0,
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_customers_restaurant 
ON mesaclik.restaurant_customers(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_customers_customer 
ON mesaclik.restaurant_customers(customer_id);

ALTER TABLE mesaclik.restaurant_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_customers_restaurant_owner" ON mesaclik.restaurant_customers;
CREATE POLICY "restaurant_customers_restaurant_owner"
ON mesaclik.restaurant_customers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "restaurant_customers_own_data" ON mesaclik.restaurant_customers;
CREATE POLICY "restaurant_customers_own_data"
ON mesaclik.restaurant_customers
FOR SELECT
USING (customer_id = auth.uid());

-- 3) Sistema 10 Cliks - Tabela de pontos de fidelidade
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesaclik.loyalty_points (
  restaurant_id uuid NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES mesaclik.customers(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  last_earned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_restaurant 
ON mesaclik.loyalty_points(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer 
ON mesaclik.loyalty_points(customer_id);

ALTER TABLE mesaclik.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_points_restaurant_owner" ON mesaclik.loyalty_points;
CREATE POLICY "loyalty_points_restaurant_owner"
ON mesaclik.loyalty_points
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = loyalty_points.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "loyalty_points_own_data" ON mesaclik.loyalty_points;
CREATE POLICY "loyalty_points_own_data"
ON mesaclik.loyalty_points
FOR SELECT
USING (customer_id = auth.uid());

-- 4) Programas de fidelidade por restaurante
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesaclik.loyalty_programs (
  restaurant_id uuid PRIMARY KEY REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  reward_description text,
  expires_at date,
  rules text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mesaclik.loyalty_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_programs_restaurant_owner" ON mesaclik.loyalty_programs;
CREATE POLICY "loyalty_programs_restaurant_owner"
ON mesaclik.loyalty_programs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = loyalty_programs.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "loyalty_programs_public_read" ON mesaclik.loyalty_programs;
CREATE POLICY "loyalty_programs_public_read"
ON mesaclik.loyalty_programs
FOR SELECT
USING (enabled = true);

-- 5) Ajustar tabela de promoções
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'coupon_link') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN coupon_link text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'coupon_asset_url') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN coupon_asset_url text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'start_date') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'end_date') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN end_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'target_audience') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN target_audience text DEFAULT 'all_opted_in';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'created_by') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'payment_status') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN payment_status text DEFAULT 'unpaid';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'price_cents') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN price_cents integer;
  END IF;
END $$;

UPDATE mesaclik.promotions 
SET start_date = starts_at::date 
WHERE start_date IS NULL AND starts_at IS NOT NULL;

UPDATE mesaclik.promotions 
SET end_date = ends_at::date 
WHERE end_date IS NULL AND ends_at IS NOT NULL;

-- 6) Criar tabela email_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesaclik.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES mesaclik.customers(id) ON DELETE SET NULL,
  promotion_id uuid REFERENCES mesaclik.promotions(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  image_url text,
  coupon_code text,
  valid_until timestamptz,
  sent_at timestamptz,
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  provider_message_id text,
  error_message text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_restaurant ON mesaclik.email_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_customer ON mesaclik.email_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_promotion ON mesaclik.email_logs(promotion_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON mesaclik.email_logs(status);

ALTER TABLE mesaclik.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_restaurant_owner" ON mesaclik.email_logs;
CREATE POLICY "email_logs_restaurant_owner"
ON mesaclik.email_logs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r
    WHERE r.id = email_logs.restaurant_id
    AND r.owner_id = auth.uid()
  )
);

-- 7) Criar tabela email_preferences_audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesaclik.email_preferences_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES mesaclik.customers(id) ON DELETE CASCADE,
  source text NOT NULL,
  action text NOT NULL,
  notes text,
  who uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_audit_customer 
ON mesaclik.email_preferences_audit(customer_id);

ALTER TABLE mesaclik.email_preferences_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_preferences_audit_insert" ON mesaclik.email_preferences_audit;
CREATE POLICY "email_preferences_audit_insert"
ON mesaclik.email_preferences_audit
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "email_preferences_audit_select" ON mesaclik.email_preferences_audit;
CREATE POLICY "email_preferences_audit_select"
ON mesaclik.email_preferences_audit
FOR SELECT
USING (true);

-- 8) View segura de clientes elegíveis para marketing (usando full_name)
-- ============================================================================
CREATE OR REPLACE VIEW mesaclik.eligible_marketing_customers_v AS
SELECT 
  c.id as customer_id,
  c.full_name as name,
  c.email,
  c.phone,
  c.marketing_opt_in,
  c.marketing_opt_in_updated_at,
  c.vip_status,
  rc.restaurant_id,
  rc.visits_count,
  rc.last_visit_at,
  COALESCE(lp.points, 0) as loyalty_points,
  lp.last_earned_at as last_points_earned
FROM mesaclik.customers c
INNER JOIN mesaclik.restaurant_customers rc ON rc.customer_id = c.id
LEFT JOIN mesaclik.loyalty_points lp ON lp.customer_id = c.id AND lp.restaurant_id = rc.restaurant_id
WHERE c.marketing_opt_in = true
ORDER BY rc.visits_count DESC, rc.last_visit_at DESC NULLS LAST;

GRANT SELECT ON mesaclik.eligible_marketing_customers_v TO authenticated;

-- 9) Função para incrementar pontos e visitas
-- ============================================================================
CREATE OR REPLACE FUNCTION mesaclik.increment_customer_loyalty(
  p_restaurant_id uuid,
  p_customer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  INSERT INTO mesaclik.restaurant_customers (
    restaurant_id, customer_id, visits_count, last_visit_at, updated_at
  )
  VALUES (p_restaurant_id, p_customer_id, 1, now(), now())
  ON CONFLICT (restaurant_id, customer_id)
  DO UPDATE SET
    visits_count = mesaclik.restaurant_customers.visits_count + 1,
    last_visit_at = now(),
    updated_at = now();

  IF EXISTS (
    SELECT 1 FROM mesaclik.loyalty_programs lp
    WHERE lp.restaurant_id = p_restaurant_id AND lp.enabled = true
  ) THEN
    INSERT INTO mesaclik.loyalty_points (
      restaurant_id, customer_id, points, last_earned_at, updated_at
    )
    VALUES (p_restaurant_id, p_customer_id, 1, now(), now())
    ON CONFLICT (restaurant_id, customer_id)
    DO UPDATE SET
      points = mesaclik.loyalty_points.points + 1,
      last_earned_at = now(),
      updated_at = now();
  END IF;
END;
$$;

-- 10) Triggers para fila e reserva
-- ============================================================================
CREATE OR REPLACE FUNCTION mesaclik.trigger_increment_loyalty_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  IF NEW.status = 'seated' AND (OLD.status IS NULL OR OLD.status != 'seated') THEN
    IF NEW.customer_id IS NOT NULL THEN
      SELECT q.restaurant_id INTO v_restaurant_id
      FROM mesaclik.queues q WHERE q.id = NEW.queue_id;
      
      IF v_restaurant_id IS NOT NULL THEN
        PERFORM mesaclik.increment_customer_loyalty(v_restaurant_id, NEW.customer_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_entry_loyalty_trigger ON mesaclik.queue_entries;
CREATE TRIGGER queue_entry_loyalty_trigger
  AFTER UPDATE ON mesaclik.queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.trigger_increment_loyalty_queue();

CREATE OR REPLACE FUNCTION mesaclik.trigger_increment_loyalty_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  IF NEW.status IN ('attended', 'completed') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('attended', 'completed')) THEN
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM mesaclik.increment_customer_loyalty(NEW.restaurant_id, NEW.customer_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservation_loyalty_trigger ON mesaclik.reservations;
CREATE TRIGGER reservation_loyalty_trigger
  AFTER UPDATE ON mesaclik.reservations
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.trigger_increment_loyalty_reservation();

-- 11) Outras funções úteis
-- ============================================================================
CREATE OR REPLACE FUNCTION mesaclik.reset_customer_loyalty_points(
  p_restaurant_id uuid,
  p_customer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.loyalty_points
  SET points = 0, updated_at = now()
  WHERE restaurant_id = p_restaurant_id AND customer_id = p_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION mesaclik.get_eligible_customers_for_promotion(
  p_restaurant_id uuid,
  p_target_audience text,
  p_min_points integer DEFAULT 10
)
RETURNS TABLE (
  customer_id uuid,
  email text,
  name text,
  visits_count integer,
  loyalty_points integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.customer_id, v.email, v.name,
    v.visits_count::integer, v.loyalty_points::integer
  FROM mesaclik.eligible_marketing_customers_v v
  WHERE v.restaurant_id = p_restaurant_id
    AND CASE p_target_audience
      WHEN 'all_opted_in' THEN true
      WHEN 'recent_visitors' THEN v.last_visit_at >= (now() - interval '90 days')
      WHEN 'loyalty_eligible' THEN v.loyalty_points >= p_min_points
      ELSE false
    END;
END;
$$;

-- 12) Tabela de unsubscribe tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesaclik.unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES mesaclik.customers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token 
ON mesaclik.unsubscribe_tokens(token) WHERE used = false;

ALTER TABLE mesaclik.unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unsubscribe_tokens_service_only" ON mesaclik.unsubscribe_tokens;
CREATE POLICY "unsubscribe_tokens_service_only"
ON mesaclik.unsubscribe_tokens
FOR ALL
USING (false);

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================
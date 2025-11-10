-- ============================================================================
-- MIGRAÇÃO: Sistema de Promoções & Marketing - Tabelas Básicas
-- ============================================================================

-- 1) Corrigir tabela customers - adicionar marketing_opt_in
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' 
                 AND table_name = 'customers' 
                 AND column_name = 'marketing_opt_in') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'mesaclik' 
                 AND table_name = 'customers' 
                 AND column_name = 'marketing_opt_in_updated_at') THEN
    ALTER TABLE mesaclik.customers ADD COLUMN marketing_opt_in_updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_marketing_opt_in 
ON mesaclik.customers(marketing_opt_in) WHERE marketing_opt_in = true;

-- 2) restaurant_customers
CREATE TABLE IF NOT EXISTS mesaclik.restaurant_customers (
  restaurant_id uuid NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES mesaclik.customers(id) ON DELETE CASCADE,
  visits_count integer NOT NULL DEFAULT 0,
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_customers_restaurant ON mesaclik.restaurant_customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_customer ON mesaclik.restaurant_customers(customer_id);

ALTER TABLE mesaclik.restaurant_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_customers_restaurant_owner" ON mesaclik.restaurant_customers;
CREATE POLICY "restaurant_customers_restaurant_owner" ON mesaclik.restaurant_customers
FOR ALL USING (EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = restaurant_customers.restaurant_id AND r.owner_id = auth.uid()));

DROP POLICY IF EXISTS "restaurant_customers_own_data" ON mesaclik.restaurant_customers;
CREATE POLICY "restaurant_customers_own_data" ON mesaclik.restaurant_customers
FOR SELECT USING (customer_id = auth.uid());

-- 3) loyalty_points
CREATE TABLE IF NOT EXISTS mesaclik.loyalty_points (
  restaurant_id uuid NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES mesaclik.customers(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  last_earned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_restaurant ON mesaclik.loyalty_points(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer ON mesaclik.loyalty_points(customer_id);

ALTER TABLE mesaclik.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_points_restaurant_owner" ON mesaclik.loyalty_points;
CREATE POLICY "loyalty_points_restaurant_owner" ON mesaclik.loyalty_points
FOR ALL USING (EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = loyalty_points.restaurant_id AND r.owner_id = auth.uid()));

DROP POLICY IF EXISTS "loyalty_points_own_data" ON mesaclik.loyalty_points;
CREATE POLICY "loyalty_points_own_data" ON mesaclik.loyalty_points
FOR SELECT USING (customer_id = auth.uid());

-- 4) loyalty_programs
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
CREATE POLICY "loyalty_programs_restaurant_owner" ON mesaclik.loyalty_programs
FOR ALL USING (EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = loyalty_programs.restaurant_id AND r.owner_id = auth.uid()));

DROP POLICY IF EXISTS "loyalty_programs_public_read" ON mesaclik.loyalty_programs;
CREATE POLICY "loyalty_programs_public_read" ON mesaclik.loyalty_programs
FOR SELECT USING (enabled = true);

-- 5) Ajustar promotions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'coupon_link') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN coupon_link text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'coupon_asset_url') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN coupon_asset_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'target_audience') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN target_audience text DEFAULT 'all_opted_in';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'created_by') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'payment_status') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN payment_status text DEFAULT 'unpaid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'mesaclik' AND table_name = 'promotions' AND column_name = 'price_cents') THEN
    ALTER TABLE mesaclik.promotions ADD COLUMN price_cents integer;
  END IF;
END $$;

-- 6) email_logs
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
CREATE POLICY "email_logs_restaurant_owner" ON mesaclik.email_logs
FOR ALL USING (EXISTS (SELECT 1 FROM mesaclik.restaurants r WHERE r.id = email_logs.restaurant_id AND r.owner_id = auth.uid()));

-- 7) email_preferences_audit
CREATE TABLE IF NOT EXISTS mesaclik.email_preferences_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES mesaclik.customers(id) ON DELETE CASCADE,
  source text NOT NULL,
  action text NOT NULL,
  notes text,
  who uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_audit_customer ON mesaclik.email_preferences_audit(customer_id);

ALTER TABLE mesaclik.email_preferences_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_preferences_audit_insert" ON mesaclik.email_preferences_audit;
CREATE POLICY "email_preferences_audit_insert" ON mesaclik.email_preferences_audit FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "email_preferences_audit_select" ON mesaclik.email_preferences_audit;
CREATE POLICY "email_preferences_audit_select" ON mesaclik.email_preferences_audit FOR SELECT USING (true);

-- 8) unsubscribe_tokens
CREATE TABLE IF NOT EXISTS mesaclik.unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES mesaclik.customers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON mesaclik.unsubscribe_tokens(token) WHERE used = false;

ALTER TABLE mesaclik.unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unsubscribe_tokens_service_only" ON mesaclik.unsubscribe_tokens;
CREATE POLICY "unsubscribe_tokens_service_only" ON mesaclik.unsubscribe_tokens FOR ALL USING (false);
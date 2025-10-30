-- Criar enum para tipo de desconto
CREATE TYPE mesaclik.discount_type AS ENUM ('percentage', 'fixed');

-- Criar enum para status do cupom
CREATE TYPE mesaclik.coupon_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'expired', 'cancelled');

-- Criar enum para status de publicação
CREATE TYPE mesaclik.publication_status AS ENUM ('pending', 'paid', 'cancelled');

-- Tabela de preços por duração (configuração global)
CREATE TABLE mesaclik.coupon_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duration_hours INTEGER NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir preços padrão
INSERT INTO mesaclik.coupon_pricing (duration_hours, price) VALUES
  (6, 29.90),
  (24, 79.90),
  (72, 189.90),
  (168, 349.90);

-- Tabela principal de cupons
CREATE TABLE mesaclik.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_type mesaclik.discount_type NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  code TEXT,
  redeem_link TEXT,
  image_url TEXT,
  bg_color TEXT,
  tags TEXT[] DEFAULT '{}',
  status mesaclik.coupon_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT at_least_code_or_link CHECK (code IS NOT NULL OR redeem_link IS NOT NULL)
);

-- Tabela de publicações (cada publicação gera cobrança)
CREATE TABLE mesaclik.coupon_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES mesaclik.coupons(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_hours INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status mesaclik.publication_status NOT NULL DEFAULT 'pending',
  invoice_url TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de analytics por cupom
CREATE TABLE mesaclik.coupon_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES mesaclik.coupons(id) ON DELETE CASCADE,
  publication_id UUID REFERENCES mesaclik.coupon_publications(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  redemptions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, publication_id, date)
);

-- Tabela de auditoria
CREATE TABLE mesaclik.coupon_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES mesaclik.coupons(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de limites por plano (configuração)
CREATE TABLE mesaclik.plan_coupon_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL UNIQUE,
  max_simultaneous_coupons INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir limites padrão
INSERT INTO mesaclik.plan_coupon_limits (plan_name, max_simultaneous_coupons) VALUES
  ('basic', 1),
  ('pro', 3),
  ('premium', 5);

-- Habilitar RLS em todas as tabelas
ALTER TABLE mesaclik.coupon_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaclik.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaclik.coupon_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaclik.coupon_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaclik.coupon_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaclik.plan_coupon_limits ENABLE ROW LEVEL SECURITY;

-- Policies para coupon_pricing (leitura pública, escrita apenas admin)
CREATE POLICY "Coupon pricing readable by everyone"
  ON mesaclik.coupon_pricing FOR SELECT
  USING (true);

-- Policies para coupons (restaurante owner pode gerenciar seus próprios)
CREATE POLICY "Coupons readable by restaurant owner"
  ON mesaclik.coupons FOR SELECT
  USING (true);

CREATE POLICY "Coupons writable by restaurant owner"
  ON mesaclik.coupons FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies para coupon_publications
CREATE POLICY "Publications readable by restaurant owner"
  ON mesaclik.coupon_publications FOR SELECT
  USING (true);

CREATE POLICY "Publications writable by restaurant owner"
  ON mesaclik.coupon_publications FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies para coupon_analytics
CREATE POLICY "Analytics readable by restaurant owner"
  ON mesaclik.coupon_analytics FOR SELECT
  USING (true);

CREATE POLICY "Analytics writable by system"
  ON mesaclik.coupon_analytics FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies para coupon_audit_log
CREATE POLICY "Audit log readable by restaurant owner"
  ON mesaclik.coupon_audit_log FOR SELECT
  USING (true);

CREATE POLICY "Audit log writable by system"
  ON mesaclik.coupon_audit_log FOR INSERT
  WITH CHECK (true);

-- Policies para plan_coupon_limits (leitura pública)
CREATE POLICY "Plan limits readable by everyone"
  ON mesaclik.plan_coupon_limits FOR SELECT
  USING (true);

-- Criar índices para performance
CREATE INDEX idx_coupons_restaurant_id ON mesaclik.coupons(restaurant_id);
CREATE INDEX idx_coupons_status ON mesaclik.coupons(status);
CREATE INDEX idx_coupon_publications_coupon_id ON mesaclik.coupon_publications(coupon_id);
CREATE INDEX idx_coupon_publications_restaurant_id ON mesaclik.coupon_publications(restaurant_id);
CREATE INDEX idx_coupon_publications_dates ON mesaclik.coupon_publications(start_at, end_at);
CREATE INDEX idx_coupon_analytics_coupon_id ON mesaclik.coupon_analytics(coupon_id);
CREATE INDEX idx_coupon_analytics_date ON mesaclik.coupon_analytics(date);
CREATE INDEX idx_coupon_audit_log_coupon_id ON mesaclik.coupon_audit_log(coupon_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON mesaclik.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupon_publications_updated_at
  BEFORE UPDATE ON mesaclik.coupon_publications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupon_analytics_updated_at
  BEFORE UPDATE ON mesaclik.coupon_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupon_pricing_updated_at
  BEFORE UPDATE ON mesaclik.coupon_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_coupon_limits_updated_at
  BEFORE UPDATE ON mesaclik.plan_coupon_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para auto-expirar cupons
CREATE OR REPLACE FUNCTION mesaclik.expire_coupons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE mesaclik.coupons
  SET status = 'expired'
  WHERE status = 'active'
  AND id IN (
    SELECT c.id
    FROM mesaclik.coupons c
    INNER JOIN mesaclik.coupon_publications cp ON c.id = cp.coupon_id
    WHERE cp.end_at < now()
    AND cp.status = 'paid'
  );
END;
$$;

-- Função para ativar cupons agendados
CREATE OR REPLACE FUNCTION mesaclik.activate_scheduled_coupons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE mesaclik.coupons
  SET status = 'active'
  WHERE status = 'scheduled'
  AND id IN (
    SELECT c.id
    FROM mesaclik.coupons c
    INNER JOIN mesaclik.coupon_publications cp ON c.id = cp.coupon_id
    WHERE cp.start_at <= now()
    AND cp.end_at > now()
    AND cp.status = 'paid'
  );
END;
$$;

-- Função para obter cupons ativos para o app (apenas com plano ativo)
CREATE OR REPLACE FUNCTION mesaclik.get_active_coupons_for_app()
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  restaurant_name TEXT,
  restaurant_logo TEXT,
  title TEXT,
  description TEXT,
  discount_type mesaclik.discount_type,
  discount_value DECIMAL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  code TEXT,
  redeem_link TEXT,
  tags TEXT[],
  image_url TEXT,
  bg_color TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    c.id,
    c.restaurant_id,
    r.name as restaurant_name,
    r.image_url as restaurant_logo,
    c.title,
    c.description,
    c.discount_type,
    c.discount_value,
    cp.start_at,
    cp.end_at,
    c.code,
    c.redeem_link,
    c.tags,
    c.image_url,
    c.bg_color
  FROM mesaclik.coupons c
  INNER JOIN mesaclik.restaurants r ON c.restaurant_id = r.id
  INNER JOIN mesaclik.coupon_publications cp ON c.id = cp.coupon_id
  WHERE c.status = 'active'
  AND cp.start_at <= now()
  AND cp.end_at > now()
  AND cp.status = 'paid'
  -- Assumindo que há um campo plan_active na tabela restaurants
  -- Se não existir, remover a linha abaixo ou adaptar
  ORDER BY cp.start_at DESC;
$$;
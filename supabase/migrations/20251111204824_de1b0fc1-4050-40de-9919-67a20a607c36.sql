-- Adicionar colunas necessárias para sistema de cupons pagos
ALTER TABLE mesaclik.coupons 
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS price NUMERIC,
  ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Atualizar cupons existentes com valores padrão
UPDATE mesaclik.coupons
SET 
  start_date = COALESCE(start_date, now()),
  end_date = COALESCE(end_date, now() + interval '7 days'),
  duration_days = COALESCE(duration_days, 7),
  price = COALESCE(price, 8.40)
WHERE start_date IS NULL OR end_date IS NULL OR duration_days IS NULL OR price IS NULL;

-- Tornar as colunas NOT NULL após preencher valores
ALTER TABLE mesaclik.coupons 
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL,
  ALTER COLUMN duration_days SET NOT NULL,
  ALTER COLUMN price SET NOT NULL;

-- Adicionar constraints
ALTER TABLE mesaclik.coupons 
  DROP CONSTRAINT IF EXISTS valid_dates;

ALTER TABLE mesaclik.coupons 
  ADD CONSTRAINT valid_dates CHECK (end_date > start_date);

ALTER TABLE mesaclik.coupons 
  DROP CONSTRAINT IF EXISTS valid_price;

ALTER TABLE mesaclik.coupons 
  ADD CONSTRAINT valid_price CHECK (price >= 2.00 AND price <= 100.00);

-- Criar índice nas datas
CREATE INDEX IF NOT EXISTS idx_coupons_dates ON mesaclik.coupons(start_date, end_date);

-- Criar tabela de aceite de termos
CREATE TABLE IF NOT EXISTS mesaclik.restaurant_terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  terms_type TEXT NOT NULL DEFAULT 'coupon_publication',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  accepted_by UUID REFERENCES auth.users(id),
  UNIQUE(restaurant_id, terms_type)
);

-- RLS para termos
ALTER TABLE mesaclik.restaurant_terms_acceptance ENABLE ROW LEVEL SECURITY;

CREATE POLICY terms_restaurant_select ON mesaclik.restaurant_terms_acceptance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_terms_acceptance.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY terms_restaurant_insert ON mesaclik.restaurant_terms_acceptance
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesaclik.restaurants r
      WHERE r.id = restaurant_terms_acceptance.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

-- Função para expirar cupons automaticamente
CREATE OR REPLACE FUNCTION mesaclik.expire_old_coupons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.coupons
  SET status = 'expired',
      updated_at = now()
  WHERE status IN ('active', 'scheduled')
    AND end_date < CURRENT_DATE;
END;
$$;

-- Função para ativar cupons agendados
CREATE OR REPLACE FUNCTION mesaclik.activate_scheduled_coupons()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO mesaclik, public
AS $$
BEGIN
  UPDATE mesaclik.coupons
  SET status = 'active',
      updated_at = now()
  WHERE status = 'scheduled'
    AND start_date <= now()
    AND end_date >= now();
END;
$$;
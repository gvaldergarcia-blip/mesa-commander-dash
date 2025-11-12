-- Adicionar campos de analytics à tabela de cupons
ALTER TABLE mesaclik.coupons 
ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS uses_count INTEGER DEFAULT 0;

-- Criar tabela de interações com cupons
CREATE TABLE IF NOT EXISTS mesaclik.coupon_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES mesaclik.coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'click', 'use')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_coupon_interactions_coupon ON mesaclik.coupon_interactions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_interactions_user ON mesaclik.coupon_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_interactions_type ON mesaclik.coupon_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_coupon_interactions_created ON mesaclik.coupon_interactions(created_at DESC);

-- RLS para coupon_interactions
ALTER TABLE mesaclik.coupon_interactions ENABLE ROW LEVEL SECURITY;

-- Usuários podem registrar suas próprias interações
CREATE POLICY coupon_interactions_insert_own
  ON mesaclik.coupon_interactions
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Restaurantes podem ver interações de seus cupons
CREATE POLICY coupon_interactions_select_restaurant
  ON mesaclik.coupon_interactions
  FOR SELECT
  USING (
    coupon_id IN (
      SELECT id FROM mesaclik.coupons c
      WHERE c.restaurant_id IN (
        SELECT id FROM mesaclik.restaurants WHERE owner_id = auth.uid()
      )
    )
  );

-- Usuários autenticados podem ver cupons ativos (status = 'active')
CREATE POLICY coupons_select_active_public
  ON mesaclik.coupons
  FOR SELECT
  USING (
    status = 'active' 
    AND start_date <= CURRENT_DATE 
    AND end_date >= CURRENT_DATE
  );

-- Função para incrementar contadores de analytics
CREATE OR REPLACE FUNCTION mesaclik.increment_coupon_analytics(
  p_coupon_id UUID,
  p_interaction_type TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_interaction_type = 'view' THEN
    UPDATE mesaclik.coupons 
    SET views_count = views_count + 1 
    WHERE id = p_coupon_id;
  ELSIF p_interaction_type = 'click' THEN
    UPDATE mesaclik.coupons 
    SET clicks_count = clicks_count + 1 
    WHERE id = p_coupon_id;
  ELSIF p_interaction_type = 'use' THEN
    UPDATE mesaclik.coupons 
    SET uses_count = uses_count + 1 
    WHERE id = p_coupon_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO mesaclik, public;

-- Trigger para atualizar analytics automaticamente
CREATE OR REPLACE FUNCTION mesaclik.update_coupon_analytics_on_interaction()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM mesaclik.increment_coupon_analytics(NEW.coupon_id, NEW.interaction_type);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO mesaclik, public;

CREATE TRIGGER trigger_update_coupon_analytics
  AFTER INSERT ON mesaclik.coupon_interactions
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.update_coupon_analytics_on_interaction();
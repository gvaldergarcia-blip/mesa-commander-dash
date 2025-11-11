-- Criar tabela de transações de pagamento
CREATE TABLE IF NOT EXISTS mesaclik.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  coupon_id UUID REFERENCES mesaclik.coupons(id) ON DELETE SET NULL,
  transaction_code TEXT NOT NULL UNIQUE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit', 'debit', 'other')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  pix_code TEXT,
  payment_provider TEXT,
  provider_transaction_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_restaurant ON mesaclik.payment_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_coupon ON mesaclik.payment_transactions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON mesaclik.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON mesaclik.payment_transactions(created_at DESC);

-- RLS Policies
ALTER TABLE mesaclik.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Restaurantes podem ver apenas suas próprias transações
CREATE POLICY payment_transactions_select_own
  ON mesaclik.payment_transactions
  FOR SELECT
  USING (
    restaurant_id IN (
      SELECT id FROM mesaclik.restaurants WHERE owner_id = auth.uid()
    )
  );

-- Restaurantes podem inserir suas próprias transações
CREATE POLICY payment_transactions_insert_own
  ON mesaclik.payment_transactions
  FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM mesaclik.restaurants WHERE owner_id = auth.uid()
    )
  );

-- Restaurantes podem atualizar suas próprias transações
CREATE POLICY payment_transactions_update_own
  ON mesaclik.payment_transactions
  FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM mesaclik.restaurants WHERE owner_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION mesaclik.update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO mesaclik, public;

CREATE TRIGGER trigger_update_payment_transactions_updated_at
  BEFORE UPDATE ON mesaclik.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION mesaclik.update_payment_transactions_updated_at();
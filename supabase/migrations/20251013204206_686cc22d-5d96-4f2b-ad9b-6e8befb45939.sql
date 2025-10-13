-- Criar o tipo enum promotion_status no schema mesaclik
DO $$ BEGIN
  CREATE TYPE mesaclik.promotion_status AS ENUM ('draft', 'scheduled', 'active', 'completed', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Adicionar colunas faltantes na tabela promotions
ALTER TABLE mesaclik.promotions 
ADD COLUMN IF NOT EXISTS audience_filter TEXT NOT NULL DEFAULT 'all',
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
ADD COLUMN IF NOT EXISTS status mesaclik.promotion_status NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Remover coluna 'active' antiga se existir
ALTER TABLE mesaclik.promotions DROP COLUMN IF EXISTS active;

-- Criar trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_promotions_updated_at ON mesaclik.promotions;
CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON mesaclik.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
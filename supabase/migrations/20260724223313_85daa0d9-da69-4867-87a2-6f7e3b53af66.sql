
-- Configuração de manipulação por produto (definida pelo estabelecimento).
-- O MesaClik apenas aplica a regra automaticamente durante a operação.
ALTER TABLE public.label_products
  ADD COLUMN IF NOT EXISTS manipulation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manipulation_validity_value INTEGER,
  ADD COLUMN IF NOT EXISTS manipulation_validity_unit TEXT
    CHECK (manipulation_validity_unit IN ('hours','days')),
  ADD COLUMN IF NOT EXISTS manipulation_notes TEXT;

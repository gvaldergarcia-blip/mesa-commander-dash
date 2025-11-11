-- Ajustar política de INSERT para permitir aceite sem autenticação (modo admin/desenvolvimento)
DROP POLICY IF EXISTS terms_restaurant_insert ON mesaclik.restaurant_terms_acceptance;

CREATE POLICY terms_restaurant_insert ON mesaclik.restaurant_terms_acceptance
  FOR INSERT
  WITH CHECK (true); -- Permite aceite sem autenticação para painel admin

-- Ajustar accepted_by para ser opcional
ALTER TABLE mesaclik.restaurant_terms_acceptance 
  ALTER COLUMN accepted_by DROP NOT NULL;
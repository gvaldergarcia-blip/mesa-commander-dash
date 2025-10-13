-- Criar política RLS pública para permitir UPDATE em restaurants durante desenvolvimento
-- IMPORTANTE: Em produção, essa política deve ser removida e substituída por uma que requer autenticação

CREATE POLICY "public_update_restaurants"
ON mesaclik.restaurants
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
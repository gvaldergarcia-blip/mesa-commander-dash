-- Remover política existente se houver
DROP POLICY IF EXISTS "Allow insert promotions" ON mesaclik.promotions;

-- Permitir inserção de promoções (sistema sem autenticação por enquanto)
CREATE POLICY "Allow insert promotions" 
ON mesaclik.promotions 
FOR INSERT 
TO public
WITH CHECK (true);
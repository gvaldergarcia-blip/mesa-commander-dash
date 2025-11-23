-- Adicionar política para permitir que o painel crie reservas
-- Esta política permite criar reservas sem autenticação, desde que o restaurant_id seja válido
CREATE POLICY "panel_can_create_reservations" 
ON mesaclik.reservations
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = reservations.restaurant_id
  )
);
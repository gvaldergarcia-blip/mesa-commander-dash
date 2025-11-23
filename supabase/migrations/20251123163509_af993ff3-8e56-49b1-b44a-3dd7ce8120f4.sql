-- Adicionar política para permitir que o painel atualize reservas
-- Esta política permite atualizar reservas sem autenticação, desde que o restaurant_id seja válido
CREATE POLICY "panel_can_update_reservations" 
ON mesaclik.reservations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = reservations.restaurant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = reservations.restaurant_id
  )
);
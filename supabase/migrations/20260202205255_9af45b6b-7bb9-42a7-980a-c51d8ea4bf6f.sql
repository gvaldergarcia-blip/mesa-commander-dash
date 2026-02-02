-- Adicionar policy de SELECT para a tabela mesaclik.reservations
-- Política simples que permite leitura se restaurant_id existe na tabela restaurants

CREATE POLICY "reservations_select_for_panel" ON mesaclik.reservations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = mesaclik.reservations.restaurant_id
  ));
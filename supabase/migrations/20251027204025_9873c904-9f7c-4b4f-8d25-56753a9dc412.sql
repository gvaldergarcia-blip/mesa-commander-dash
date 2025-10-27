-- Adicionar constraint única para evitar duplicatas
ALTER TABLE mesaclik.restaurant_calendar 
ADD CONSTRAINT restaurant_calendar_unique_day 
UNIQUE (restaurant_id, day);

-- Habilitar realtime para a tabela
ALTER TABLE mesaclik.restaurant_calendar REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE mesaclik.restaurant_calendar;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_restaurant_calendar_restaurant_day 
ON mesaclik.restaurant_calendar(restaurant_id, day);

-- Criar índice para queries de disponibilidade
CREATE INDEX IF NOT EXISTS idx_restaurant_calendar_available 
ON mesaclik.restaurant_calendar(restaurant_id, is_open, day);
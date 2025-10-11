-- Criar tabela de calendário de disponibilidade para restaurantes
CREATE TABLE IF NOT EXISTS mesaclik.restaurant_calendar (
  restaurant_id UUID NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (restaurant_id, day)
);

-- Índice para consultas rápidas por restaurante e data
CREATE INDEX IF NOT EXISTS idx_restaurant_calendar_restaurant_day 
  ON mesaclik.restaurant_calendar(restaurant_id, day);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_restaurant_calendar_updated_at
  BEFORE UPDATE ON mesaclik.restaurant_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE mesaclik.restaurant_calendar ENABLE ROW LEVEL SECURITY;

-- Policy para leitura pública (usuários do app podem ver dias disponíveis)
CREATE POLICY "Calendar readable by everyone"
  ON mesaclik.restaurant_calendar
  FOR SELECT
  USING (true);

-- Policy para restaurantes gerenciarem seu próprio calendário
CREATE POLICY "Calendar writable by restaurant owner"
  ON mesaclik.restaurant_calendar
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE mesaclik.restaurant_calendar IS 'Calendário de disponibilidade dos restaurantes para controle de dias abertos/fechados';
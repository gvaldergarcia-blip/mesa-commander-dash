-- Criar tabela de datas especiais
CREATE TABLE IF NOT EXISTS restaurant_special_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  open_time TIME,
  close_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de fechamentos
CREATE TABLE IF NOT EXISTS restaurant_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de configurações da fila
CREATE TABLE IF NOT EXISTS queue_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  max_party_size INTEGER NOT NULL DEFAULT 8,
  queue_capacity INTEGER NOT NULL DEFAULT 50,
  avg_time_1_2 INTEGER NOT NULL DEFAULT 30,
  avg_time_3_4 INTEGER NOT NULL DEFAULT 45,
  avg_time_5_6 INTEGER NOT NULL DEFAULT 60,
  avg_time_7_8 INTEGER NOT NULL DEFAULT 75,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de configurações de reservas
CREATE TABLE IF NOT EXISTS reservation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  max_party_size INTEGER NOT NULL DEFAULT 8,
  tolerance_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies para restaurant_special_dates
ALTER TABLE restaurant_special_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "special_dates_owner_manage" ON restaurant_special_dates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = restaurant_special_dates.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "special_dates_public_read" ON restaurant_special_dates
  FOR SELECT USING (true);

-- RLS Policies para restaurant_closures
ALTER TABLE restaurant_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "closures_owner_manage" ON restaurant_closures
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = restaurant_closures.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "closures_public_read" ON restaurant_closures
  FOR SELECT USING (true);

-- RLS Policies para queue_settings
ALTER TABLE queue_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_settings_owner_manage" ON queue_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = queue_settings.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "queue_settings_public_read" ON queue_settings
  FOR SELECT USING (true);

-- RLS Policies para reservation_settings
ALTER TABLE reservation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservation_settings_owner_manage" ON reservation_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = reservation_settings.restaurant_id
      AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "reservation_settings_public_read" ON reservation_settings
  FOR SELECT USING (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_special_dates_updated_at
  BEFORE UPDATE ON restaurant_special_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_closures_updated_at
  BEFORE UPDATE ON restaurant_closures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_settings_updated_at
  BEFORE UPDATE ON queue_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservation_settings_updated_at
  BEFORE UPDATE ON reservation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
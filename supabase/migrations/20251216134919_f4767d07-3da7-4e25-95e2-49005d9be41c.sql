-- Criar tabela mesaclik.restaurant_hours (fonte de verdade para a Tela Comando / app)
-- Motivo: o painel hoje tenta salvar em public.restaurant_hours, mas o restaurante está em mesaclik.restaurants
-- e a operação falha por RLS + FK/consistência de schema.

CREATE TABLE IF NOT EXISTS mesaclik.restaurant_hours (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES mesaclik.restaurants(id) ON DELETE CASCADE,
  -- Postgres EXTRACT(DOW): 0=Dom, 1=Seg, ..., 6=Sáb
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME,
  close_time TIME
);

-- Evita duplicidade por restaurante/dia
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_hours_restaurant_day_uniq
  ON mesaclik.restaurant_hours (restaurant_id, day_of_week);

CREATE INDEX IF NOT EXISTS restaurant_hours_restaurant_idx
  ON mesaclik.restaurant_hours (restaurant_id);

ALTER TABLE mesaclik.restaurant_hours ENABLE ROW LEVEL SECURITY;

-- Leitura pública (app pode consultar sem login)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mesaclik'
      AND tablename = 'restaurant_hours'
      AND policyname = 'restaurant_hours_public_read'
  ) THEN
    CREATE POLICY restaurant_hours_public_read
    ON mesaclik.restaurant_hours
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Dono do restaurante gerencia (para quando houver auth no painel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mesaclik'
      AND tablename = 'restaurant_hours'
      AND policyname = 'restaurant_hours_owner_manage'
  ) THEN
    CREATE POLICY restaurant_hours_owner_manage
    ON mesaclik.restaurant_hours
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM mesaclik.restaurants r
        WHERE r.id = restaurant_hours.restaurant_id
          AND r.owner_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM mesaclik.restaurants r
        WHERE r.id = restaurant_hours.restaurant_id
          AND r.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Painel (sem auth) consegue salvar para restaurantes válidos
-- (espelha o padrão já usado em 'panel_can_create_reservations')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'mesaclik'
      AND tablename = 'restaurant_hours'
      AND policyname = 'panel_can_manage_restaurant_hours'
  ) THEN
    CREATE POLICY panel_can_manage_restaurant_hours
    ON mesaclik.restaurant_hours
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM mesaclik.restaurants r
        WHERE r.id = restaurant_hours.restaurant_id
      )
    );

    -- UPDATE
    CREATE POLICY panel_can_update_restaurant_hours
    ON mesaclik.restaurant_hours
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM mesaclik.restaurants r
        WHERE r.id = restaurant_hours.restaurant_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM mesaclik.restaurants r
        WHERE r.id = restaurant_hours.restaurant_id
      )
    );

    -- DELETE
    CREATE POLICY panel_can_delete_restaurant_hours
    ON mesaclik.restaurant_hours
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1
        FROM mesaclik.restaurants r
        WHERE r.id = restaurant_hours.restaurant_id
      )
    );
  END IF;
END $$;
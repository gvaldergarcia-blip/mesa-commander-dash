-- =============================================================
-- REMOVER FK E SINCRONIZAR mesaclik → public
-- =============================================================

-- 1) Remover FK existente (nome exato do pg_constraint)
ALTER TABLE public.restaurant_hours
DROP CONSTRAINT restaurant_hours_restaurant_id_fkey;

-- 2) Criar índice único para ON CONFLICT funcionar (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_hours_public_restaurant_day_uniq
ON public.restaurant_hours (restaurant_id, day_of_week);

-- 3) Sincronização inicial: copiar dados de mesaclik → public
INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, open_time, close_time)
SELECT restaurant_id, day_of_week, open_time, close_time
FROM mesaclik.restaurant_hours
ON CONFLICT (restaurant_id, day_of_week) DO UPDATE
SET open_time = EXCLUDED.open_time,
    close_time = EXCLUDED.close_time;
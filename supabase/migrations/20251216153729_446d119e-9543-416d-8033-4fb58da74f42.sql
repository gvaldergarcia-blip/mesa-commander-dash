-- Reverter escrita direta no schema public (evita políticas anônimas de escrita)
-- e sincronizar via trigger (mesaclik -> public) como fonte de verdade.

-- 1) Remover policies de escrita anônima que foram adicionadas
DROP POLICY IF EXISTS restaurant_hours_panel_insert ON public.restaurant_hours;
DROP POLICY IF EXISTS restaurant_hours_panel_update ON public.restaurant_hours;
DROP POLICY IF EXISTS restaurant_hours_panel_delete ON public.restaurant_hours;

-- 2) Função de sync (executa no contexto do owner via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.sync_restaurant_hours_to_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, mesaclik, extensions
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.restaurant_hours
    WHERE restaurant_id = OLD.restaurant_id
      AND day_of_week = OLD.day_of_week;
    RETURN OLD;
  ELSE
    -- Mantém apenas 1 registro por (restaurant_id, day_of_week)
    DELETE FROM public.restaurant_hours
    WHERE restaurant_id = NEW.restaurant_id
      AND day_of_week = NEW.day_of_week;

    INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, open_time, close_time)
    VALUES (NEW.restaurant_id, NEW.day_of_week, NEW.open_time, NEW.close_time);

    RETURN NEW;
  END IF;
END;
$$;

-- 3) Impedir chamada direta por clientes
REVOKE EXECUTE ON FUNCTION public.sync_restaurant_hours_to_public() FROM PUBLIC;

-- 4) Trigger no schema mesaclik (fonte de verdade do painel)
DROP TRIGGER IF EXISTS trigger_sync_restaurant_hours_to_public ON mesaclik.restaurant_hours;

CREATE TRIGGER trigger_sync_restaurant_hours_to_public
AFTER INSERT OR UPDATE OR DELETE ON mesaclik.restaurant_hours
FOR EACH ROW
EXECUTE FUNCTION public.sync_restaurant_hours_to_public();
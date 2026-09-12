-- 1. Adiciona coluna de módulos contratados em public.restaurants
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS plan_modules_list text[];

-- 2. Adiciona coluna correspondente em mesaclik.restaurants
ALTER TABLE mesaclik.restaurants ADD COLUMN IF NOT EXISTS plan_modules_list text[];

-- 3. Função para obter módulos contratados (prioriza nova lista, com fallback legado)
CREATE OR REPLACE FUNCTION public.get_contracted_modules(p_restaurant_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
DECLARE
  v_modules text[];
  v_legacy text;
BEGIN
  -- Tenta ler a nova lista em public.restaurants
  SELECT plan_modules_list INTO v_modules
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF v_modules IS NOT NULL AND array_length(v_modules, 1) > 0 THEN
    RETURN v_modules;
  END IF;

  -- Fallback: converte o campo legado plan_modules para a nova lista
  SELECT plan_modules INTO v_legacy
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF v_legacy = 'FILA' THEN
    RETURN ARRAY['dashboard', 'fila'];
  ELSIF v_legacy = 'RESERVA' THEN
    RETURN ARRAY['dashboard', 'reservas'];
  ELSIF v_legacy = 'FILA_RESERVA' THEN
    RETURN ARRAY['dashboard', 'fila', 'reservas'];
  ELSE
    -- Caso não consiga identificar, libera tudo para não quebrar acesso existente
    RETURN ARRAY['dashboard', 'fila', 'reservas', 'clientes', 'promocoes', 'relatorios', 'checklist', 'etiquetas', 'marketing_ia', 'studio'];
  END IF;
END;
$$;

-- 4. Preenche todos os restaurantes existentes com a lista completa de módulos
UPDATE public.restaurants
SET plan_modules_list = ARRAY['dashboard', 'fila', 'reservas', 'clientes', 'promocoes', 'relatorios', 'checklist', 'etiquetas', 'marketing_ia', 'studio']
WHERE plan_modules_list IS NULL;

-- 5. Espelha em mesaclik.restaurants
UPDATE mesaclik.restaurants
SET plan_modules_list = ARRAY['dashboard', 'fila', 'reservas', 'clientes', 'promocoes', 'relatorios', 'checklist', 'etiquetas', 'marketing_ia', 'studio']
WHERE plan_modules_list IS NULL;

-- 6. Garante permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION public.get_contracted_modules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contracted_modules(uuid) TO service_role;

-- 7. Trigger para manter mesaclik.restaurants sincronizado quando public.restaurants mudar
CREATE OR REPLACE FUNCTION public.sync_plan_modules_list_to_mesaclik()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
BEGIN
  UPDATE mesaclik.restaurants
  SET plan_modules_list = NEW.plan_modules_list
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_plan_modules_list_to_mesaclik() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_plan_modules_list_to_mesaclik() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_plan_modules_list_to_mesaclik ON public.restaurants;
CREATE TRIGGER trg_sync_plan_modules_list_to_mesaclik
AFTER UPDATE OF plan_modules_list ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.sync_plan_modules_list_to_mesaclik();

-- 8. Trigger para manter public.restaurants sincronizado quando mesaclik.restaurants mudar
CREATE OR REPLACE FUNCTION mesaclik.sync_plan_modules_list_to_public()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  UPDATE public.restaurants
  SET plan_modules_list = NEW.plan_modules_list
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION mesaclik.sync_plan_modules_list_to_public() TO authenticated;
GRANT EXECUTE ON FUNCTION mesaclik.sync_plan_modules_list_to_public() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_plan_modules_list_to_public ON mesaclik.restaurants;
CREATE TRIGGER trg_sync_plan_modules_list_to_public
AFTER UPDATE OF plan_modules_list ON mesaclik.restaurants
FOR EACH ROW
EXECUTE FUNCTION mesaclik.sync_plan_modules_list_to_public();

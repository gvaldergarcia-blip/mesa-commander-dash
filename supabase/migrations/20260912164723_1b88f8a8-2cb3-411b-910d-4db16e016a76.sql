-- 0. Helper para remover duplicatas de array (precisa existir antes de ser usado)
CREATE OR REPLACE FUNCTION public.array_distinct(arr text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT array_agg(DISTINCT x ORDER BY x)
  FROM unnest(arr) AS x
$$;

GRANT EXECUTE ON FUNCTION public.array_distinct(text[]) TO authenticated, service_role;

-- 1. Adiciona coluna de lista de módulos no schema public
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS plan_modules_list text[] DEFAULT ARRAY['fila','reservas'];

-- 2. Adiciona coluna de lista de módulos no schema mesaclik
ALTER TABLE mesaclik.restaurants ADD COLUMN IF NOT EXISTS plan_modules_list text[] DEFAULT ARRAY['fila','reservas'];

-- 3. Converte valores legados para a nova lista
UPDATE public.restaurants
SET plan_modules_list = CASE
  WHEN upper(plan_modules) = 'FILA' THEN ARRAY['fila']
  WHEN upper(plan_modules) = 'RESERVA' THEN ARRAY['reservas']
  WHEN upper(plan_modules) = 'FILA_RESERVA' THEN ARRAY['fila','reservas']
  ELSE ARRAY['fila','reservas']
END
WHERE plan_modules_list IS NULL OR array_length(plan_modules_list, 1) IS NULL;

-- 4. Garante que restaurantes atuais tenham todos os módulos que já visualizam hoje
UPDATE public.restaurants
SET plan_modules_list = array_distinct(plan_modules_list || ARRAY['etiquetas','checklist','clientes','relatorios','social','promocoes']);

-- 5. Sincroniza schema mesaclik
UPDATE mesaclik.restaurants m
SET plan_modules_list = r.plan_modules_list
FROM public.restaurants r
WHERE m.id = r.id;

-- 6. Atualiza função de sincronização public -> mesaclik
CREATE OR REPLACE FUNCTION public.sync_restaurant_to_mesaclik()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO mesaclik.restaurants (
    id, name, owner_id, cuisine, city, address_line, has_queue, has_reservation,
    image_url, created_at, updated_at, status, approved_at, plan_modules, plan_modules_list
  )
  VALUES (
    NEW.id, NEW.name, NEW.owner_id, NEW.cuisine::text, NEW.city, NEW.address_line,
    NEW.has_queue, NEW.has_reservation, NEW.image_url, NEW.created_at, NEW.updated_at,
    NEW.status, NEW.approved_at, NEW.plan_modules, NEW.plan_modules_list
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    owner_id = EXCLUDED.owner_id,
    cuisine = EXCLUDED.cuisine,
    city = EXCLUDED.city,
    address_line = EXCLUDED.address_line,
    has_queue = EXCLUDED.has_queue,
    has_reservation = EXCLUDED.has_reservation,
    image_url = EXCLUDED.image_url,
    updated_at = EXCLUDED.updated_at,
    status = EXCLUDED.status,
    approved_at = EXCLUDED.approved_at,
    plan_modules = EXCLUDED.plan_modules,
    plan_modules_list = EXCLUDED.plan_modules_list;
  RETURN NEW;
END;
$$;

-- 7. Atualiza função de sincronização de plan_status
CREATE OR REPLACE FUNCTION public.sync_plan_status_to_mesaclik()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE mesaclik.restaurants
  SET plan_status = NEW.plan_status,
      trial_ends_at = NEW.trial_ends_at,
      is_active = (NEW.plan_status IN ('trial', 'ativo'))
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- 8. Permissões na tabela (já existente, reforço)
GRANT SELECT, INSERT, UPDATE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;
GRANT SELECT, INSERT, UPDATE ON mesaclik.restaurants TO authenticated;
GRANT ALL ON mesaclik.restaurants TO service_role;
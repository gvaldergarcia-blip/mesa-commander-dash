-- Corrige RLS do fluxo de reservas (painel/anon) e ajusta helper de permissão

-- 1) Função SECURITY DEFINER para checar existência de restaurante sem depender de RLS em mesaclik.restaurants
CREATE OR REPLACE FUNCTION mesaclik.restaurant_exists(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = mesaclik
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM mesaclik.restaurants r
    WHERE r.id = p_restaurant_id
  );
$$;

-- 2) Recriar políticas do painel para usar a função acima (evita falha por RLS na tabela restaurants)
DROP POLICY IF EXISTS panel_can_create_reservations ON mesaclik.reservations;
CREATE POLICY panel_can_create_reservations
ON mesaclik.reservations
FOR INSERT
TO public
WITH CHECK (mesaclik.restaurant_exists(restaurant_id));

DROP POLICY IF EXISTS panel_can_update_reservations ON mesaclik.reservations;
CREATE POLICY panel_can_update_reservations
ON mesaclik.reservations
FOR UPDATE
TO public
USING (mesaclik.restaurant_exists(restaurant_id))
WITH CHECK (mesaclik.restaurant_exists(restaurant_id));

-- 3) Ajustar helper de permissão criado anteriormente: restaurantes estão no schema mesaclik (não no public)
CREATE OR REPLACE FUNCTION mesaclik.is_admin_or_restaurant_member(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mesaclik
AS $$
  SELECT
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM mesaclik.restaurants r
      WHERE r.id = p_restaurant_id
        AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.restaurant_members m
      WHERE m.restaurant_id = p_restaurant_id
        AND m.user_id = auth.uid()
    );
$$;

-- Permitir que o painel (rodando com anon/public) sincronize horários para o schema public,
-- já que o app consome public.restaurant_hours.
-- Mantém SELECT público e habilita INSERT/UPDATE/DELETE apenas quando restaurant_id existir em mesaclik.restaurants.

ALTER TABLE public.restaurant_hours ENABLE ROW LEVEL SECURITY;

-- Policies (idempotente)
DROP POLICY IF EXISTS restaurant_hours_panel_insert ON public.restaurant_hours;
DROP POLICY IF EXISTS restaurant_hours_panel_update ON public.restaurant_hours;
DROP POLICY IF EXISTS restaurant_hours_panel_delete ON public.restaurant_hours;

CREATE POLICY restaurant_hours_panel_insert
ON public.restaurant_hours
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM mesaclik.restaurants r
    WHERE r.id = restaurant_hours.restaurant_id
  )
);

CREATE POLICY restaurant_hours_panel_update
ON public.restaurant_hours
FOR UPDATE
TO public
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

CREATE POLICY restaurant_hours_panel_delete
ON public.restaurant_hours
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM mesaclik.restaurants r
    WHERE r.id = restaurant_hours.restaurant_id
  )
);

-- Observação: SELECT público já existe (restaurant_hours_public_read).
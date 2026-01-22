-- Corrigir políticas RLS do CRM para usar mesaclik.restaurants (onde está o owner_id)
-- Isso permite que o dono do restaurante veja os clientes no /customers.

-- restaurant_customers
DROP POLICY IF EXISTS restaurant_customers_owner_read ON public.restaurant_customers;
DROP POLICY IF EXISTS restaurant_customers_owner_write ON public.restaurant_customers;

CREATE POLICY restaurant_customers_owner_read
ON public.restaurant_customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM mesaclik.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

CREATE POLICY restaurant_customers_owner_write
ON public.restaurant_customers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM mesaclik.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM mesaclik.restaurants r
    WHERE r.id = restaurant_customers.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

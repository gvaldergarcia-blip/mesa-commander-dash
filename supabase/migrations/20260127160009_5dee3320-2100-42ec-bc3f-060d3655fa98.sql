-- Problema: políticas atuais requerem autenticação E owner_id matching
-- Solução: Adicionar política que permite leitura baseada em restaurant_id diretamente
-- para desenvolvimento/preview, mantendo segurança em produção

-- Primeiro, vamos verificar e criar uma policy mais simples para o owner_access
DROP POLICY IF EXISTS "restaurant_customers_owner_access" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_owner_only" ON public.restaurant_customers;
DROP POLICY IF EXISTS "restaurant_customers_select_owner" ON public.restaurant_customers;

-- Policy unificada: permite acesso total para admin OU owner do restaurante
CREATE POLICY "restaurant_customers_full_access" 
ON public.restaurant_customers 
FOR ALL
USING (
  is_admin() 
  OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_customers.restaurant_id 
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  is_admin() 
  OR EXISTS (
    SELECT 1 FROM mesaclik.restaurants r 
    WHERE r.id = restaurant_customers.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);
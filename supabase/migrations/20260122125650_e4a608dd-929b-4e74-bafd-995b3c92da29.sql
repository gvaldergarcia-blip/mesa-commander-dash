-- Permitir leitura (SELECT) de restaurant_customers para o role anon (painel sem login)
-- ATENÇÃO: isso torna os dados do CRM acessíveis publicamente via API. Use apenas se a tela comando realmente não terá autenticação.

DROP POLICY IF EXISTS restaurant_customers_anon_read ON public.restaurant_customers;

CREATE POLICY restaurant_customers_anon_read
ON public.restaurant_customers
FOR SELECT
TO anon
USING (true);

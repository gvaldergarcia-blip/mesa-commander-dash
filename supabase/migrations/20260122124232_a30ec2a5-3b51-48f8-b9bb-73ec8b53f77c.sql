-- Remove a FK que aponta para public.restaurants (que está vazia)
-- A tabela restaurant_customers precisa funcionar sem essa constraint
-- pois os restaurantes estão em mesaclik.restaurants

ALTER TABLE public.restaurant_customers 
DROP CONSTRAINT IF EXISTS restaurant_customers_restaurant_id_fkey;

-- Adicionar FK apontando para mesaclik.restaurants
ALTER TABLE public.restaurant_customers
ADD CONSTRAINT restaurant_customers_restaurant_id_fkey
FOREIGN KEY (restaurant_id) REFERENCES mesaclik.restaurants(id);
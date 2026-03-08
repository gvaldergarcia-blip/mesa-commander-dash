
-- Add birthday column to restaurant_customers
ALTER TABLE public.restaurant_customers 
ADD COLUMN IF NOT EXISTS birthday date;

-- Add comment
COMMENT ON COLUMN public.restaurant_customers.birthday IS 'Data de aniversário do cliente para campanhas e insights';

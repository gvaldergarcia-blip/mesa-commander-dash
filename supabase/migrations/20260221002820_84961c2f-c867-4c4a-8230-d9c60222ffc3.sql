
-- Add loyalty_program_active field to restaurant_customers for individual opt-in control
ALTER TABLE public.restaurant_customers
ADD COLUMN loyalty_program_active boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.restaurant_customers.loyalty_program_active IS 'Whether this customer is individually enrolled in the loyalty program';

-- Adicionar colunas para tracking de visitas concluídas
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS queue_completed INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reservations_completed INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_visit_at TIMESTAMP WITH TIME ZONE;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- Atualizar registros existentes para garantir que first_visit_at seja preenchido
UPDATE public.customers 
SET first_visit_at = created_at 
WHERE first_visit_at IS NULL;

COMMENT ON COLUMN public.customers.queue_completed IS 'Número de vezes que o cliente completou a fila (status = seated)';
COMMENT ON COLUMN public.customers.reservations_completed IS 'Número de vezes que o cliente completou uma reserva (status = completed)';
COMMENT ON COLUMN public.customers.first_visit_at IS 'Data da primeira visita do cliente';
-- Criar tabela de clientes/profiles de usuários
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  total_visits INTEGER NOT NULL DEFAULT 0,
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  last_visit_date TIMESTAMP WITH TIME ZONE,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  vip_status BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar enum para status de reservas
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'canceled');

-- Criar tabela de reservas
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  reservation_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  status reservation_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  canceled_at TIMESTAMP WITH TIME ZONE,
  canceled_by TEXT,
  cancel_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar enum para status da fila
CREATE TYPE queue_status AS ENUM ('waiting', 'called', 'seated', 'canceled', 'no_show');

-- Criar enum para prioridade da fila  
CREATE TYPE queue_priority AS ENUM ('normal', 'high', 'vip');

-- Criar tabela de filas por restaurante
CREATE TABLE public.queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Queue',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de entradas na fila
CREATE TABLE public.queue_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  priority queue_priority NOT NULL DEFAULT 'normal',
  status queue_status NOT NULL DEFAULT 'waiting',
  position_number INTEGER,
  notes TEXT,
  estimated_wait_time INTEGER, -- em minutos
  called_at TIMESTAMP WITH TIME ZONE,
  seated_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar enum para status de promoções
CREATE TYPE promotion_status AS ENUM ('draft', 'scheduled', 'active', 'completed', 'canceled');

-- Criar tabela de promoções
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  audience_filter TEXT NOT NULL DEFAULT 'all', -- all, vip, new, inactive
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status promotion_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar enum para status de emails
CREATE TYPE email_status AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');

-- Criar tabela de logs de email
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status email_status NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para customers
CREATE POLICY "Customers readable by restaurant owner" ON public.customers
  FOR SELECT USING (true); -- Por enquanto público para teste

CREATE POLICY "Customers writable by restaurant owner" ON public.customers  
  FOR ALL USING (true) WITH CHECK (true); -- Por enquanto público para teste

-- Criar políticas RLS para reservations
CREATE POLICY "Reservations readable by restaurant owner" ON public.reservations
  FOR SELECT USING (true);

CREATE POLICY "Reservations writable by restaurant owner" ON public.reservations
  FOR ALL USING (true) WITH CHECK (true);

-- Criar políticas RLS para queues
CREATE POLICY "Queues readable by restaurant owner" ON public.queues
  FOR SELECT USING (true);

CREATE POLICY "Queues writable by restaurant owner" ON public.queues
  FOR ALL USING (true) WITH CHECK (true);

-- Criar políticas RLS para queue_entries  
CREATE POLICY "Queue entries readable by restaurant owner" ON public.queue_entries
  FOR SELECT USING (true);

CREATE POLICY "Queue entries writable by restaurant owner" ON public.queue_entries
  FOR ALL USING (true) WITH CHECK (true);

-- Criar políticas RLS para promotions
CREATE POLICY "Promotions readable by restaurant owner" ON public.promotions
  FOR SELECT USING (true);

CREATE POLICY "Promotions writable by restaurant owner" ON public.promotions
  FOR ALL USING (true) WITH CHECK (true);

-- Criar políticas RLS para email_logs
CREATE POLICY "Email logs readable by restaurant owner" ON public.email_logs
  FOR SELECT USING (true);

CREATE POLICY "Email logs writable by restaurant owner" ON public.email_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Criar função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar triggers para updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_queues_updated_at
  BEFORE UPDATE ON public.queues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_queue_entries_updated_at
  BEFORE UPDATE ON public.queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar fila padrão para cada restaurante existente
INSERT INTO public.queues (restaurant_id, name)
SELECT id, 'Fila Principal' FROM public.restaurants
WHERE NOT EXISTS (SELECT 1 FROM public.queues WHERE restaurant_id = restaurants.id);

-- Criar alguns dados de exemplo
INSERT INTO public.customers (name, email, phone, total_visits, total_spent, marketing_opt_in, vip_status) VALUES
('Maria Silva', 'maria@email.com', '(11) 99999-9999', 15, 1250.50, true, true),
('João Santos', 'joao@email.com', '(11) 88888-8888', 3, 340.80, true, false),
('Ana Costa', 'ana@email.com', '(11) 77777-7777', 8, 680.20, false, false);

-- Inserir algumas reservas de exemplo (assumindo que existe pelo menos um restaurante)
INSERT INTO public.reservations (restaurant_id, customer_name, phone, party_size, reservation_datetime, status, notes)
SELECT 
  r.id,
  'Carlos Oliveira',
  '(11) 99999-1111', 
  4, 
  now() + interval '2 hours',
  'confirmed',
  'Jantar de negócios - mesa silenciosa'
FROM public.restaurants r LIMIT 1;
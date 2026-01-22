-- Tabela para consentimento de termos por ticket da fila
CREATE TABLE public.queue_terms_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  ticket_id UUID NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  terms_version TEXT NOT NULL DEFAULT 'v1',
  privacy_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, ticket_id)
);

-- Tabela para opt-in de marketing por restaurante/cliente
CREATE TABLE public.restaurant_marketing_optins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  marketing_optin BOOLEAN NOT NULL DEFAULT false,
  marketing_optin_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, customer_email)
);

-- Índices para consultas rápidas
CREATE INDEX idx_queue_terms_consents_restaurant ON public.queue_terms_consents(restaurant_id);
CREATE INDEX idx_queue_terms_consents_email ON public.queue_terms_consents(customer_email);
CREATE INDEX idx_restaurant_marketing_optins_restaurant ON public.restaurant_marketing_optins(restaurant_id);
CREATE INDEX idx_restaurant_marketing_optins_email ON public.restaurant_marketing_optins(customer_email);

-- Enable RLS
ALTER TABLE public.queue_terms_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_marketing_optins ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para queue_terms_consents
CREATE POLICY "Donos podem ver consentimentos do seu restaurante"
ON public.queue_terms_consents FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.restaurants
  WHERE restaurants.id = queue_terms_consents.restaurant_id
  AND restaurants.owner_id = auth.uid()
));

CREATE POLICY "Qualquer um pode inserir consentimento"
ON public.queue_terms_consents FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar seu próprio consentimento"
ON public.queue_terms_consents FOR UPDATE
USING (true);

-- Políticas RLS para restaurant_marketing_optins
CREATE POLICY "Donos podem ver optins do seu restaurante"
ON public.restaurant_marketing_optins FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.restaurants
  WHERE restaurants.id = restaurant_marketing_optins.restaurant_id
  AND restaurants.owner_id = auth.uid()
));

CREATE POLICY "Qualquer um pode inserir optin"
ON public.restaurant_marketing_optins FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar seu próprio optin"
ON public.restaurant_marketing_optins FOR UPDATE
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_queue_terms_consents_updated_at
BEFORE UPDATE ON public.queue_terms_consents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_marketing_optins_updated_at
BEFORE UPDATE ON public.restaurant_marketing_optins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- =============================================
-- TABELA PRINCIPAL: restaurant_customers (CRM consolidado)
-- =============================================
CREATE TABLE IF NOT EXISTS public.restaurant_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_queue_visits INTEGER NOT NULL DEFAULT 0,
  total_reservation_visits INTEGER NOT NULL DEFAULT 0,
  total_visits INTEGER GENERATED ALWAYS AS (total_queue_visits + total_reservation_visits) STORED,
  vip BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  marketing_optin BOOLEAN NOT NULL DEFAULT false,
  marketing_optin_at TIMESTAMPTZ,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  
  -- Chave única para não duplicar cliente por restaurante
  CONSTRAINT unique_restaurant_customer UNIQUE (restaurant_id, customer_email)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_restaurant ON public.restaurant_customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_email ON public.restaurant_customers(customer_email);
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_status ON public.restaurant_customers(status);
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_marketing ON public.restaurant_customers(marketing_optin);
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_last_seen ON public.restaurant_customers(last_seen_at);

-- RLS
ALTER TABLE public.restaurant_customers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "restaurant_customers_owner_read" ON public.restaurant_customers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_customers.restaurant_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "restaurant_customers_owner_write" ON public.restaurant_customers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_customers.restaurant_id AND r.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_customers.restaurant_id AND r.owner_id = auth.uid())
  );

-- Política para inserção anônima (fluxo fila/reserva)
CREATE POLICY "restaurant_customers_anon_insert" ON public.restaurant_customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "restaurant_customers_anon_update" ON public.restaurant_customers
  FOR UPDATE USING (true) WITH CHECK (true);

-- =============================================
-- TABELA: restaurant_campaigns (campanhas de e-mail)
-- =============================================
CREATE TABLE IF NOT EXISTS public.restaurant_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  cta_text TEXT,
  cta_url TEXT,
  coupon_code TEXT,
  expires_at TIMESTAMPTZ,
  audience_filter JSONB DEFAULT '{"type": "all"}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  total_recipients INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_restaurant_campaigns_restaurant ON public.restaurant_campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_campaigns_status ON public.restaurant_campaigns(status);

-- RLS
ALTER TABLE public.restaurant_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_campaigns_owner_all" ON public.restaurant_campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_campaigns.restaurant_id AND r.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_campaigns.restaurant_id AND r.owner_id = auth.uid())
  );

-- =============================================
-- TABELA: restaurant_campaign_recipients (destinatários)
-- =============================================
CREATE TABLE IF NOT EXISTS public.restaurant_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.restaurant_campaigns(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.restaurant_customers(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  sent_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  error_message TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.restaurant_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON public.restaurant_campaign_recipients(delivery_status);

-- RLS
ALTER TABLE public.restaurant_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_recipients_owner_all" ON public.restaurant_campaign_recipients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_campaign_recipients.restaurant_id AND r.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_campaign_recipients.restaurant_id AND r.owner_id = auth.uid())
  );

-- =============================================
-- TRIGGER: Atualizar updated_at automaticamente
-- =============================================
CREATE OR REPLACE FUNCTION public.update_restaurant_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_restaurant_customers_updated_at
  BEFORE UPDATE ON public.restaurant_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_restaurant_customers_updated_at();

CREATE TRIGGER trigger_restaurant_campaigns_updated_at
  BEFORE UPDATE ON public.restaurant_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_restaurant_customers_updated_at();

-- =============================================
-- FUNÇÃO: Upsert cliente no CRM (chamada pelo fluxo fila/reserva)
-- =============================================
CREATE OR REPLACE FUNCTION public.upsert_restaurant_customer(
  p_restaurant_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'queue', -- 'queue' ou 'reservation'
  p_marketing_optin BOOLEAN DEFAULT NULL,
  p_terms_accepted BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  INSERT INTO public.restaurant_customers (
    restaurant_id,
    customer_email,
    customer_name,
    customer_phone,
    last_seen_at,
    total_queue_visits,
    total_reservation_visits,
    marketing_optin,
    marketing_optin_at,
    terms_accepted,
    terms_accepted_at
  )
  VALUES (
    p_restaurant_id,
    lower(trim(p_email)),
    NULLIF(trim(p_name), ''),
    NULLIF(trim(p_phone), ''),
    now(),
    CASE WHEN p_source = 'queue' THEN 1 ELSE 0 END,
    CASE WHEN p_source = 'reservation' THEN 1 ELSE 0 END,
    COALESCE(p_marketing_optin, false),
    CASE WHEN p_marketing_optin = true THEN now() ELSE NULL END,
    COALESCE(p_terms_accepted, false),
    CASE WHEN p_terms_accepted = true THEN now() ELSE NULL END
  )
  ON CONFLICT (restaurant_id, customer_email) DO UPDATE SET
    customer_name = COALESCE(NULLIF(trim(EXCLUDED.customer_name), ''), restaurant_customers.customer_name),
    customer_phone = COALESCE(NULLIF(trim(EXCLUDED.customer_phone), ''), restaurant_customers.customer_phone),
    last_seen_at = now(),
    total_queue_visits = restaurant_customers.total_queue_visits + CASE WHEN p_source = 'queue' THEN 1 ELSE 0 END,
    total_reservation_visits = restaurant_customers.total_reservation_visits + CASE WHEN p_source = 'reservation' THEN 1 ELSE 0 END,
    marketing_optin = CASE 
      WHEN p_marketing_optin IS NOT NULL THEN p_marketing_optin 
      ELSE restaurant_customers.marketing_optin 
    END,
    marketing_optin_at = CASE 
      WHEN p_marketing_optin = true AND restaurant_customers.marketing_optin = false THEN now()
      ELSE restaurant_customers.marketing_optin_at 
    END,
    terms_accepted = CASE 
      WHEN p_terms_accepted IS NOT NULL THEN p_terms_accepted 
      ELSE restaurant_customers.terms_accepted 
    END,
    terms_accepted_at = CASE 
      WHEN p_terms_accepted = true AND restaurant_customers.terms_accepted = false THEN now()
      ELSE restaurant_customers.terms_accepted_at 
    END,
    -- Atualizar status para ativo se estava inativo
    status = 'active',
    -- Atualizar VIP se atingiu 10 visitas
    vip = CASE 
      WHEN (restaurant_customers.total_queue_visits + restaurant_customers.total_reservation_visits + 1) >= 10 THEN true
      ELSE restaurant_customers.vip 
    END
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$;
-- Adicionar campos de marketing opt-in na tabela customers
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'marketing_opt_in') THEN
    ALTER TABLE public.customers ADD COLUMN marketing_opt_in boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'marketing_opt_in_updated_at') THEN
    ALTER TABLE public.customers ADD COLUMN marketing_opt_in_updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Remover tabelas antigas se existirem
DROP TABLE IF EXISTS public.email_preferences_audit CASCADE;
DROP TABLE IF EXISTS public.email_logs CASCADE;

-- Criar tabela de logs de email
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  image_url text,
  coupon_code text,
  valid_until timestamptz,
  sent_at timestamptz,
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  provider_message_id text,
  error_message text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de auditoria de preferências
CREATE TABLE public.email_preferences_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  source text NOT NULL CHECK (source IN ('app', 'painel', 'import')),
  action text NOT NULL CHECK (action IN ('opt_in', 'opt_out', 'manual_override_for_tests')),
  who uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_preferences_audit ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para email_logs
CREATE POLICY "email_logs_select_all"
ON public.email_logs FOR SELECT
USING (true);

CREATE POLICY "email_logs_insert_all"
ON public.email_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "email_logs_update_all"
ON public.email_logs FOR UPDATE
USING (true)
WITH CHECK (true);

-- Criar políticas RLS para email_preferences_audit
CREATE POLICY "email_prefs_audit_select_all"
ON public.email_preferences_audit FOR SELECT
USING (true);

CREATE POLICY "email_prefs_audit_insert_all"
ON public.email_preferences_audit FOR INSERT
WITH CHECK (true);

-- Trigger para atualizar updated_at em email_logs
CREATE OR REPLACE FUNCTION public.update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_email_logs_updated_at();

-- Criar índices para performance
CREATE INDEX idx_email_logs_restaurant_id ON public.email_logs(restaurant_id);
CREATE INDEX idx_email_logs_customer_id ON public.email_logs(customer_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at DESC);
CREATE INDEX idx_email_preferences_audit_customer_id ON public.email_preferences_audit(customer_id);
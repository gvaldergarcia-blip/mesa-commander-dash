
-- =============================================
-- PROGRAMA DE FIDELIDADE (LOYALTY PROGRAM)
-- =============================================

-- Tabela de configuração do programa por restaurante
CREATE TABLE IF NOT EXISTS public.restaurant_loyalty_program (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  program_name TEXT NOT NULL DEFAULT 'Programa Clique',
  required_visits INT NOT NULL DEFAULT 10,
  count_queue BOOLEAN NOT NULL DEFAULT true,
  count_reservations BOOLEAN NOT NULL DEFAULT true,
  reward_description TEXT NOT NULL DEFAULT '',
  reward_validity_days INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Tabela de status de fidelidade por cliente
CREATE TABLE IF NOT EXISTS public.customer_loyalty_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  current_visits INT NOT NULL DEFAULT 0,
  reward_unlocked BOOLEAN NOT NULL DEFAULT false,
  reward_unlocked_at TIMESTAMPTZ,
  reward_expires_at TIMESTAMPTZ,
  activation_email_sent BOOLEAN NOT NULL DEFAULT false,
  reward_email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, customer_id)
);

-- Enable RLS
ALTER TABLE public.restaurant_loyalty_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restaurant_loyalty_program
CREATE POLICY "loyalty_program_tenant_select" ON public.restaurant_loyalty_program
  FOR SELECT USING (is_member_or_admin(restaurant_id));

CREATE POLICY "loyalty_program_tenant_insert" ON public.restaurant_loyalty_program
  FOR INSERT WITH CHECK (is_member_or_admin(restaurant_id));

CREATE POLICY "loyalty_program_tenant_update" ON public.restaurant_loyalty_program
  FOR UPDATE USING (is_member_or_admin(restaurant_id));

CREATE POLICY "loyalty_program_tenant_delete" ON public.restaurant_loyalty_program
  FOR DELETE USING (is_member_or_admin(restaurant_id));

-- RLS Policies for customer_loyalty_status
CREATE POLICY "loyalty_status_tenant_select" ON public.customer_loyalty_status
  FOR SELECT USING (is_member_or_admin(restaurant_id));

CREATE POLICY "loyalty_status_tenant_insert" ON public.customer_loyalty_status
  FOR INSERT WITH CHECK (is_member_or_admin(restaurant_id));

CREATE POLICY "loyalty_status_tenant_update" ON public.customer_loyalty_status
  FOR UPDATE USING (is_member_or_admin(restaurant_id));

CREATE POLICY "loyalty_status_tenant_delete" ON public.customer_loyalty_status
  FOR DELETE USING (is_member_or_admin(restaurant_id));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_loyalty_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_loyalty_program_updated_at
  BEFORE UPDATE ON public.restaurant_loyalty_program
  FOR EACH ROW EXECUTE FUNCTION public.update_loyalty_updated_at();

CREATE TRIGGER trg_loyalty_status_updated_at
  BEFORE UPDATE ON public.customer_loyalty_status
  FOR EACH ROW EXECUTE FUNCTION public.update_loyalty_updated_at();

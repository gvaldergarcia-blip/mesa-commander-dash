
-- 1. Tabela restaurant_applications
CREATE TABLE IF NOT EXISTS public.restaurant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  restaurant_name text NOT NULL,
  cuisine text NOT NULL DEFAULT 'Outros',
  address_line text,
  district text,
  city text,
  state text,
  zip_code text,
  owner_email text NOT NULL,
  owner_phone text,
  status text NOT NULL DEFAULT 'pending',
  restaurant_id uuid,
  approved_at timestamptz,
  approved_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_applications ENABLE ROW LEVEL SECURITY;

-- Admin pode ver/gerenciar todas (usar versão com argumento explícito)
CREATE POLICY "applications_admin_all" ON public.restaurant_applications
  FOR ALL USING (public.is_admin(auth.uid()));

-- Usuário pode ver a própria
CREATE POLICY "applications_own_select" ON public.restaurant_applications
  FOR SELECT USING (auth.uid() = owner_user_id);

-- Usuário pode criar a própria
CREATE POLICY "applications_own_insert" ON public.restaurant_applications
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

-- 2. Constraint única em restaurant_members para evitar duplicatas
ALTER TABLE public.restaurant_members
  ADD CONSTRAINT restaurant_members_user_restaurant_unique
  UNIQUE (user_id, restaurant_id);

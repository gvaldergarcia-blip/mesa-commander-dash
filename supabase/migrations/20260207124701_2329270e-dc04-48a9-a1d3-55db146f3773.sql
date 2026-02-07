-- Garantir que o restaurante Mocotó tenha políticas de acesso para desenvolvimento

-- Dropar políticas existentes para restaurants (se existirem) e recriar
DROP POLICY IF EXISTS "restaurants_dev_select" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_dev_all" ON public.restaurants;

-- Política de SELECT para qualquer um (anon e authenticated) ver restaurantes
CREATE POLICY "restaurants_public_select"
ON public.restaurants
FOR SELECT
USING (true);

-- Política de UPDATE para owner ou admin
CREATE POLICY "restaurants_owner_update"
ON public.restaurants
FOR UPDATE
USING (
  owner_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Verificar se RLS está habilitado
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
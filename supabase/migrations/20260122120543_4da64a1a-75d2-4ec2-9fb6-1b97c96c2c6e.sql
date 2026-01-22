-- Remover políticas antigas que não funcionam
DROP POLICY IF EXISTS "Qualquer um pode inserir consentimento" ON public.queue_terms_consents;
DROP POLICY IF EXISTS "Qualquer um pode atualizar seu próprio consentimento" ON public.queue_terms_consents;
DROP POLICY IF EXISTS "Qualquer um pode inserir optin" ON public.restaurant_marketing_optins;
DROP POLICY IF EXISTS "Qualquer um pode atualizar seu próprio optin" ON public.restaurant_marketing_optins;

-- Criar políticas que funcionam para anon e authenticated
-- queue_terms_consents
CREATE POLICY "anon_insert_queue_terms_consents"
ON public.queue_terms_consents FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "anon_update_queue_terms_consents"
ON public.queue_terms_consents FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "anon_select_queue_terms_consents"
ON public.queue_terms_consents FOR SELECT
TO anon, authenticated
USING (true);

-- restaurant_marketing_optins
CREATE POLICY "anon_insert_restaurant_marketing_optins"
ON public.restaurant_marketing_optins FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "anon_update_restaurant_marketing_optins"
ON public.restaurant_marketing_optins FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "anon_select_restaurant_marketing_optins"
ON public.restaurant_marketing_optins FOR SELECT
TO anon, authenticated
USING (true);
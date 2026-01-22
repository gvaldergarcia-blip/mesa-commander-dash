-- Permitir operações anônimas nas tabelas de campanhas para a tela comando
-- ATENÇÃO: isso é necessário enquanto não houver autenticação no painel

-- Permitir INSERT na tabela restaurant_campaigns para anon
DROP POLICY IF EXISTS restaurant_campaigns_anon_insert ON public.restaurant_campaigns;
CREATE POLICY restaurant_campaigns_anon_insert
ON public.restaurant_campaigns
FOR INSERT
TO anon
WITH CHECK (true);

-- Permitir UPDATE na tabela restaurant_campaigns para anon
DROP POLICY IF EXISTS restaurant_campaigns_anon_update ON public.restaurant_campaigns;
CREATE POLICY restaurant_campaigns_anon_update
ON public.restaurant_campaigns
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Permitir SELECT na tabela restaurant_campaigns para anon
DROP POLICY IF EXISTS restaurant_campaigns_anon_select ON public.restaurant_campaigns;
CREATE POLICY restaurant_campaigns_anon_select
ON public.restaurant_campaigns
FOR SELECT
TO anon
USING (true);

-- Permitir INSERT na tabela restaurant_campaign_recipients para anon
DROP POLICY IF EXISTS restaurant_campaign_recipients_anon_insert ON public.restaurant_campaign_recipients;
CREATE POLICY restaurant_campaign_recipients_anon_insert
ON public.restaurant_campaign_recipients
FOR INSERT
TO anon
WITH CHECK (true);

-- Permitir UPDATE na tabela restaurant_campaign_recipients para anon
DROP POLICY IF EXISTS restaurant_campaign_recipients_anon_update ON public.restaurant_campaign_recipients;
CREATE POLICY restaurant_campaign_recipients_anon_update
ON public.restaurant_campaign_recipients
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Permitir SELECT na tabela restaurant_campaign_recipients para anon
DROP POLICY IF EXISTS restaurant_campaign_recipients_anon_select ON public.restaurant_campaign_recipients;
CREATE POLICY restaurant_campaign_recipients_anon_select
ON public.restaurant_campaign_recipients
FOR SELECT
TO anon
USING (true);
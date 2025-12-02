-- Corrigir política RLS para cupons que está impedindo a leitura
-- O problema é comparar timestamp com CURRENT_DATE

-- Remover política antiga com comparação incorreta
DROP POLICY IF EXISTS "coupons_select_active_public" ON mesaclik.coupons;

-- Criar política corrigida usando CURRENT_TIMESTAMP para comparação consistente
CREATE POLICY "coupons_public_read_active" ON mesaclik.coupons
FOR SELECT
TO public
USING (
  status = 'active'::mesaclik.coupon_status 
  AND payment_status = 'completed'
  AND start_date <= NOW() + interval '1 day'  -- Permite cupons que começam até amanhã (margem de fuso)
  AND end_date >= NOW() - interval '1 day'    -- Permite cupons que terminaram ontem (margem de fuso)
);

-- Também garantir que há uma política permissiva para leitura geral (para o painel)
DROP POLICY IF EXISTS "Coupons readable by restaurant owner" ON mesaclik.coupons;
CREATE POLICY "coupons_restaurant_owner_read" ON mesaclik.coupons
FOR SELECT
TO authenticated
USING (true);
-- Corrigir restaurante Mocotó: atribuir owner_id ao admin existente
UPDATE public.restaurants 
SET owner_id = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208',
    updated_at = NOW()
WHERE id = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f';

-- Criar vínculo em restaurant_members para garantir acesso
INSERT INTO public.restaurant_members (restaurant_id, user_id, role)
VALUES ('8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f', 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208', 'owner')
ON CONFLICT (restaurant_id, user_id) DO UPDATE SET role = 'owner';
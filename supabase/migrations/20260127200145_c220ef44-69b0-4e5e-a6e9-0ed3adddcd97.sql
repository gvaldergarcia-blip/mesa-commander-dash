-- Migração: Reformular fluxo de reservas para usar email em vez de telefone
-- 1. Adicionar coluna customer_email (obrigatório para novas reservas)
-- 2. Tornar phone opcional (mantendo para reservas antigas)

-- Adicionar customer_email se não existir
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS customer_email text;

-- Tornar phone opcional
ALTER TABLE public.reservations 
ALTER COLUMN phone DROP NOT NULL;

-- Dropar a view existente e recriar com a nova coluna
DROP VIEW IF EXISTS mesaclik.v_reservations;

CREATE VIEW mesaclik.v_reservations AS
SELECT 
  r.id as reservation_id,
  r.restaurant_id,
  r.customer_name,
  r.phone,
  r.customer_email,
  r.party_size as people,
  r.reservation_datetime as starts_at,
  r.status,
  r.notes,
  r.cancel_reason,
  r.canceled_at,
  r.canceled_by,
  r.created_at,
  r.updated_at,
  rest.name as restaurant_name,
  rest.address as restaurant_address,
  rest.cuisine as restaurant_cuisine
FROM public.reservations r
LEFT JOIN public.restaurants rest ON rest.id = r.restaurant_id
ORDER BY r.reservation_datetime ASC;

-- Adicionar comentário na tabela
COMMENT ON COLUMN public.reservations.customer_email IS 'E-mail do cliente para contato e envio de confirmação';
COMMENT ON COLUMN public.reservations.phone IS 'Telefone do cliente (opcional, mantido para compatibilidade)';
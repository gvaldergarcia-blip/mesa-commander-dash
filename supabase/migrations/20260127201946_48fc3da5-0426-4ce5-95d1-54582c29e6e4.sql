-- Add customer_email column to mesaclik.reservations table
ALTER TABLE mesaclik.reservations 
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN mesaclik.reservations.customer_email IS 'E-mail do cliente para contato e envio de confirmações';

-- Update v_reservations view to include customer_email
DROP VIEW IF EXISTS mesaclik.v_reservations;

CREATE VIEW mesaclik.v_reservations AS
SELECT 
  r.id as reservation_id,
  r.restaurant_id,
  r.user_id,
  r.name as customer_name,
  r.phone,
  r.customer_email,
  r.party_size as people,
  r.reserved_for as starts_at,
  r.status,
  r.notes,
  r.canceled_at,
  r.canceled_by,
  r.cancel_reason,
  r.confirmed_at,
  r.completed_at,
  r.no_show_at,
  r.created_at,
  r.updated_at,
  rest.name as restaurant_name,
  rest.address as restaurant_address,
  rest.cuisine as restaurant_cuisine
FROM mesaclik.reservations r
LEFT JOIN public.restaurants rest ON rest.id = r.restaurant_id;
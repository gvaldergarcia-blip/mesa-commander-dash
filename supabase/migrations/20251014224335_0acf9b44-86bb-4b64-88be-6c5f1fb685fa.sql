-- Corrigir a view v_reservations para não ter filtro hardcoded de restaurant_id
DROP VIEW IF EXISTS mesaclik.v_reservations;

CREATE OR REPLACE VIEW mesaclik.v_reservations AS
SELECT 
    id AS reservation_id,
    restaurant_id,
    name AS customer_name,
    phone,
    party_size AS people,
    COALESCE(reserved_for, reservation_at) AS starts_at,
    status,
    notes,
    canceled_at,
    created_at,
    updated_at
FROM mesaclik.reservations;
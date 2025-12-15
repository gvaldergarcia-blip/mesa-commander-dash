-- sql/queue_position_tela_comando.sql
--
-- Fonte única de verdade (canonical) para cálculo de posição da fila, igual à Tela Comando.
--
-- REGRAS (OBRIGATÓRIAS):
-- 1) Considerar apenas registros das últimas 24 horas
-- 2) Considerar apenas status = 'waiting'
-- 3) Filtrar por restaurant_id (multi-tenant)
-- 4) Ordenação determinística: created_at ASC, id ASC
-- 5) Posição = ROW_NUMBER() na lista ordenada (1-indexed)
--
-- PARAMS (use placeholders no seu client):
--   :restaurant_id (uuid)
--   :ticket_id (uuid) opcional

-- =====================================================================
-- A) Snapshot para 1 ticket (totais + posição + dados do ticket)
-- =====================================================================
WITH
  params AS (
    SELECT
      :restaurant_id::uuid AS restaurant_id,
      :ticket_id::uuid AS ticket_id,
      (now() - interval '24 hours') AS cutoff
  ),
  waiting AS (
    SELECT
      qe.id,
      qe.restaurant_id,
      qe.queue_id,
      qe.party_size,
      qe.created_at,
      qe.name,
      qe.phone
    FROM mesaclik.queue_entries qe
    JOIN params p ON p.restaurant_id = qe.restaurant_id
    WHERE qe.status = 'waiting'
      AND qe.created_at >= (SELECT cutoff FROM params)
  ),
  ranked AS (
    SELECT
      w.*,
      row_number() OVER (ORDER BY w.created_at ASC, w.id ASC) AS position
    FROM waiting w
  )
SELECT
  (SELECT COUNT(*) FROM waiting) AS total_groups,
  (SELECT COALESCE(SUM(party_size), 0) FROM waiting) AS total_people,
  (SELECT position FROM ranked r JOIN params p ON r.id = p.ticket_id) AS position,
  (SELECT jsonb_build_object(
    'id', r.id,
    'queue_id', r.queue_id,
    'party_size', r.party_size,
    'customer_name', r.name,
    'phone', r.phone,
    'created_at', r.created_at
  ) FROM ranked r JOIN params p ON r.id = p.ticket_id) AS user_entry,
  (SELECT cutoff FROM params) AS cutoff;

-- =====================================================================
-- B) Lista completa (para debug / conferência): id + position
-- =====================================================================
-- WITH params AS (
--   SELECT :restaurant_id::uuid AS restaurant_id,
--          (now() - interval '24 hours') AS cutoff
-- ),
-- waiting AS (
--   SELECT qe.*
--   FROM mesaclik.queue_entries qe
--   JOIN params p ON p.restaurant_id = qe.restaurant_id
--   WHERE qe.status = 'waiting'
--     AND qe.created_at >= (SELECT cutoff FROM params)
-- )
-- SELECT
--   id,
--   row_number() OVER (ORDER BY created_at ASC, id ASC) AS position,
--   name,
--   phone,
--   party_size,
--   created_at
-- FROM waiting
-- ORDER BY created_at ASC, id ASC;

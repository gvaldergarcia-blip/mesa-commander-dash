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
-- =====================================================================
-- VERSÃO PARA SQL EDITOR (substitua os UUIDs abaixo pelos seus valores)
-- =====================================================================

-- ▼▼▼ SUBSTITUA ESTES VALORES ▼▼▼
WITH params AS (
  SELECT
    'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AS restaurant_id,  -- SEU restaurant_id
    'b59d3d0a-7f44-48f1-8594-27aef2eebda2'::uuid AS ticket_id,     -- SEU ticket_id (ou NULL)
    (now() - interval '24 hours') AS cutoff
),
-- ▲▲▲ SUBSTITUA ESTES VALORES ▲▲▲

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
  CROSS JOIN params p
  WHERE qe.restaurant_id = p.restaurant_id
    AND qe.status = 'waiting'
    AND qe.created_at >= p.cutoff
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
  r.position,
  jsonb_build_object(
    'id', r.id,
    'queue_id', r.queue_id,
    'party_size', r.party_size,
    'customer_name', r.name,
    'phone', r.phone,
    'created_at', r.created_at
  ) AS user_entry,
  p.cutoff
FROM ranked r
CROSS JOIN params p
WHERE r.id = p.ticket_id;

-- =====================================================================
-- LISTA COMPLETA (debug): todas as posições do restaurante
-- =====================================================================
-- WITH params AS (
--   SELECT
--     'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AS restaurant_id,
--     (now() - interval '24 hours') AS cutoff
-- ),
-- waiting AS (
--   SELECT qe.*
--   FROM mesaclik.queue_entries qe
--   CROSS JOIN params p
--   WHERE qe.restaurant_id = p.restaurant_id
--     AND qe.status = 'waiting'
--     AND qe.created_at >= p.cutoff
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

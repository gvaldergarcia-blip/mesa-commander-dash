-- =====================================================================
-- HORÁRIOS DO RESTAURANTE - SQL CANÔNICO (Tela Comando)
-- =====================================================================
-- Este arquivo é a FONTE DE VERDADE para consultas de horários.
-- O app Flutter DEVE replicar esta lógica para exibir horários corretos.
--
-- TABELAS ENVOLVIDAS:
--   1) mesaclik.restaurant_hours - Horários regulares (seg-dom)
--   2) mesaclik.restaurant_special_dates - Datas especiais com horário diferente
--   3) mesaclik.restaurant_closures - Dias de fechamento extraordinário
--
-- REGRAS DE NEGÓCIO:
--   1) restaurant_hours: day_of_week = 0 (Domingo) a 6 (Sábado)
--   2) Se open_time/close_time = NULL, o dia está FECHADO
--   3) restaurant_special_dates sobrescreve restaurant_hours para a data específica
--   4) restaurant_closures indica fechamento total (sem open/close)
--   5) Prioridade: closures > special_dates > hours (regular)
--
-- =====================================================================

-- ▼▼▼ SUBSTITUA ESTE VALOR ▼▼▼
WITH params AS (
  SELECT
    'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AS restaurant_id,  -- SEU restaurant_id
    CURRENT_DATE AS target_date  -- Data para verificar (ou substitua por uma data específica)
),
-- ▲▲▲ SUBSTITUA ESTE VALOR ▲▲▲

-- =====================================================================
-- A) HORÁRIOS REGULARES DA SEMANA (todos os 7 dias)
-- =====================================================================
regular_hours AS (
  SELECT
    rh.day_of_week,
    CASE rh.day_of_week
      WHEN 0 THEN 'Domingo'
      WHEN 1 THEN 'Segunda-feira'
      WHEN 2 THEN 'Terça-feira'
      WHEN 3 THEN 'Quarta-feira'
      WHEN 4 THEN 'Quinta-feira'
      WHEN 5 THEN 'Sexta-feira'
      WHEN 6 THEN 'Sábado'
    END AS day_name,
    rh.open_time,
    rh.close_time,
    CASE 
      WHEN rh.open_time IS NOT NULL AND rh.close_time IS NOT NULL THEN true
      ELSE false
    END AS is_open
  FROM mesaclik.restaurant_hours rh
  CROSS JOIN params p
  WHERE rh.restaurant_id = p.restaurant_id
  ORDER BY rh.day_of_week
)
SELECT * FROM regular_hours;

-- =====================================================================
-- B) VERIFICAR SE ESTÁ ABERTO HOJE (com todas as regras)
-- =====================================================================
-- WITH params AS (
--   SELECT
--     'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AS restaurant_id,
--     CURRENT_DATE AS target_date,
--     EXTRACT(DOW FROM CURRENT_DATE)::int AS today_dow
-- ),
-- -- Verificar se há fechamento extraordinário
-- closure_check AS (
--   SELECT EXISTS (
--     SELECT 1 FROM mesaclik.restaurant_closures rc
--     CROSS JOIN params p
--     WHERE rc.restaurant_id = p.restaurant_id
--       AND rc.date = p.target_date
--   ) AS is_closed_today
-- ),
-- -- Verificar se há data especial
-- special_date AS (
--   SELECT 
--     rsd.open_time,
--     rsd.close_time,
--     rsd.reason
--   FROM mesaclik.restaurant_special_dates rsd
--   CROSS JOIN params p
--   WHERE rsd.restaurant_id = p.restaurant_id
--     AND rsd.date = p.target_date
--   LIMIT 1
-- ),
-- -- Horário regular do dia
-- regular_today AS (
--   SELECT 
--     rh.open_time,
--     rh.close_time
--   FROM mesaclik.restaurant_hours rh
--   CROSS JOIN params p
--   WHERE rh.restaurant_id = p.restaurant_id
--     AND rh.day_of_week = p.today_dow
--   LIMIT 1
-- )
-- SELECT
--   p.target_date,
--   p.today_dow,
--   cc.is_closed_today,
--   CASE
--     WHEN cc.is_closed_today THEN 'FECHADO (fechamento extraordinário)'
--     WHEN sd.open_time IS NOT NULL THEN 
--       'ABERTO (horário especial): ' || sd.open_time::text || ' - ' || sd.close_time::text
--     WHEN rt.open_time IS NOT NULL THEN 
--       'ABERTO: ' || rt.open_time::text || ' - ' || rt.close_time::text
--     ELSE 'FECHADO (sem horário definido)'
--   END AS status_hoje,
--   COALESCE(sd.open_time, rt.open_time) AS open_time,
--   COALESCE(sd.close_time, rt.close_time) AS close_time
-- FROM params p
-- CROSS JOIN closure_check cc
-- LEFT JOIN special_date sd ON true
-- LEFT JOIN regular_today rt ON true;

-- =====================================================================
-- C) LISTAR PRÓXIMOS 7 DIAS COM STATUS
-- =====================================================================
-- WITH params AS (
--   SELECT 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AS restaurant_id
-- ),
-- next_7_days AS (
--   SELECT generate_series(
--     CURRENT_DATE,
--     CURRENT_DATE + interval '6 days',
--     interval '1 day'
--   )::date AS date
-- )
-- SELECT
--   d.date,
--   EXTRACT(DOW FROM d.date)::int AS day_of_week,
--   CASE EXTRACT(DOW FROM d.date)::int
--     WHEN 0 THEN 'Dom'
--     WHEN 1 THEN 'Seg'
--     WHEN 2 THEN 'Ter'
--     WHEN 3 THEN 'Qua'
--     WHEN 4 THEN 'Qui'
--     WHEN 5 THEN 'Sex'
--     WHEN 6 THEN 'Sáb'
--   END AS day_abbr,
--   -- Fechamento extraordinário?
--   EXISTS (
--     SELECT 1 FROM mesaclik.restaurant_closures rc
--     CROSS JOIN params p
--     WHERE rc.restaurant_id = p.restaurant_id AND rc.date = d.date
--   ) AS is_closure,
--   -- Horário especial?
--   (SELECT rsd.open_time FROM mesaclik.restaurant_special_dates rsd
--    CROSS JOIN params p WHERE rsd.restaurant_id = p.restaurant_id AND rsd.date = d.date) AS special_open,
--   (SELECT rsd.close_time FROM mesaclik.restaurant_special_dates rsd
--    CROSS JOIN params p WHERE rsd.restaurant_id = p.restaurant_id AND rsd.date = d.date) AS special_close,
--   -- Horário regular
--   (SELECT rh.open_time FROM mesaclik.restaurant_hours rh
--    CROSS JOIN params p WHERE rh.restaurant_id = p.restaurant_id 
--    AND rh.day_of_week = EXTRACT(DOW FROM d.date)::int) AS regular_open,
--   (SELECT rh.close_time FROM mesaclik.restaurant_hours rh
--    CROSS JOIN params p WHERE rh.restaurant_id = p.restaurant_id 
--    AND rh.day_of_week = EXTRACT(DOW FROM d.date)::int) AS regular_close
-- FROM next_7_days d
-- ORDER BY d.date;

-- =====================================================================
-- ESTRUTURA DAS TABELAS (referência)
-- =====================================================================
-- 
-- mesaclik.restaurant_hours:
--   id (bigint, PK)
--   restaurant_id (uuid, FK)
--   day_of_week (smallint, 0-6: Dom-Sáb)
--   open_time (time, nullable - NULL = fechado)
--   close_time (time, nullable - NULL = fechado)
--
-- mesaclik.restaurant_special_dates:
--   id (uuid, PK)
--   restaurant_id (uuid, FK)
--   date (date)
--   open_time (time, nullable)
--   close_time (time, nullable)
--   reason (text, nullable)
--   created_at, updated_at
--
-- mesaclik.restaurant_closures:
--   id (uuid, PK)
--   restaurant_id (uuid, FK)
--   date (date)
--   reason (text, nullable)
--   created_at, updated_at

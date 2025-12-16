-- =====================================================================
-- HORÁRIOS DO RESTAURANTE - SQL CANÔNICO (Tela Comando)
-- =====================================================================
-- Este arquivo é a FONTE DE VERDADE para consultas de horários.
-- O app (Flutter) DEVE replicar esta lógica para exibir horários corretos.
--
-- TABELAS ENVOLVIDAS (neste projeto, estão no schema PUBLIC):
--   1) public.restaurant_hours - Horários regulares (semana)
--   2) public.restaurant_special_dates - Datas especiais com horário diferente
--   3) public.restaurant_closures - Dias de fechamento extraordinário
--
-- REGRAS DE NEGÓCIO CRÍTICAS:
--   1) restaurant_hours.day_of_week segue Postgres EXTRACT(DOW):
--        0=Domingo, 1=Segunda, ..., 6=Sábado
--   2) Se open_time/close_time = NULL, o dia está FECHADO
--   3) restaurant_special_dates sobrescreve restaurant_hours para a data
--   4) restaurant_closures indica fechamento total (sem open/close)
--   5) Prioridade: closures > special_dates > hours (regular)
--
--   ⚠️ REGRA CRUCIAL - RESTAURANTES SEM HORÁRIOS CONFIGURADOS:
--   6) Se um restaurante NÃO TEM registros em restaurant_hours,
--      ele deve ser considerado "SEM RESTRIÇÃO DE HORÁRIO" (sempre aberto)
--      (ou seja: NÃO mostrar como "fechado" por falta de cadastro).
--
-- =====================================================================

-- ▼▼▼ SUBSTITUA ESTE VALOR ▼▼▼
WITH params AS (
  SELECT
    'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AS restaurant_id,  -- SEU restaurant_id
    CURRENT_DATE AS target_date
),
-- ▲▲▲ SUBSTITUA ESTE VALOR ▲▲▲

-- =====================================================================
-- A) VERIFICAR SE RESTAURANTE TEM HORÁRIOS CONFIGURADOS
-- =====================================================================
has_hours_configured AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_hours rh
    CROSS JOIN params p
    WHERE rh.restaurant_id = p.restaurant_id
  ) AS has_hours
),

-- =====================================================================
-- B) HORÁRIOS REGULARES DA SEMANA
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
  FROM public.restaurant_hours rh
  CROSS JOIN params p
  WHERE rh.restaurant_id = p.restaurant_id
  ORDER BY rh.day_of_week
)
SELECT
  hc.has_hours AS restaurante_tem_horarios_configurados,
  rh.*
FROM has_hours_configured hc
LEFT JOIN regular_hours rh ON true;

-- =====================================================================
-- C) VERIFICAR SE ESTÁ ABERTO NA DATA (usando todas as regras)
-- =====================================================================
-- Descomente para usar:
/*
WITH params AS (
  SELECT
    'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AS restaurant_id,
    CURRENT_DATE AS target_date,
    EXTRACT(DOW FROM CURRENT_DATE)::int AS target_dow
),
has_hours AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_hours rh
    CROSS JOIN params p
    WHERE rh.restaurant_id = p.restaurant_id
  ) AS configured
),
closure_check AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_closures rc
    CROSS JOIN params p
    WHERE rc.restaurant_id = p.restaurant_id
      AND rc.date = p.target_date
  ) AS is_closed
),
special_date AS (
  SELECT
    rsd.open_time,
    rsd.close_time,
    rsd.reason
  FROM public.restaurant_special_dates rsd
  CROSS JOIN params p
  WHERE rsd.restaurant_id = p.restaurant_id
    AND rsd.date = p.target_date
  LIMIT 1
),
regular_today AS (
  SELECT
    rh.open_time,
    rh.close_time
  FROM public.restaurant_hours rh
  CROSS JOIN params p
  WHERE rh.restaurant_id = p.restaurant_id
    AND rh.day_of_week = p.target_dow
  LIMIT 1
)
SELECT
  p.target_date,
  p.target_dow,
  hh.configured AS tem_horarios_configurados,
  cc.is_closed AS is_closed_today,
  CASE
    WHEN NOT hh.configured THEN 'ABERTO (sem restrição de horário)'
    WHEN cc.is_closed THEN 'FECHADO (fechamento extraordinário)'
    WHEN sd.open_time IS NOT NULL AND sd.close_time IS NOT NULL THEN
      'ABERTO (horário especial): ' || sd.open_time::text || ' - ' || sd.close_time::text
    WHEN rt.open_time IS NOT NULL AND rt.close_time IS NOT NULL THEN
      'ABERTO: ' || rt.open_time::text || ' - ' || rt.close_time::text
    ELSE 'FECHADO (sem horário para o dia)'
  END AS status_na_data,
  COALESCE(sd.open_time, rt.open_time) AS open_time,
  COALESCE(sd.close_time, rt.close_time) AS close_time,
  sd.reason AS special_reason
FROM params p
CROSS JOIN has_hours hh
CROSS JOIN closure_check cc
LEFT JOIN special_date sd ON true
LEFT JOIN regular_today rt ON true;
*/

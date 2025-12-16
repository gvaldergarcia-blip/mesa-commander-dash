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
-- REGRAS DE NEGÓCIO CRÍTICAS:
--   1) restaurant_hours: day_of_week = 0 (Domingo) a 6 (Sábado)
--   2) Se open_time/close_time = NULL, o dia está FECHADO
--   3) restaurant_special_dates sobrescreve restaurant_hours para a data específica
--   4) restaurant_closures indica fechamento total (sem open/close)
--   5) Prioridade: closures > special_dates > hours (regular)
--
--   ⚠️ REGRA CRUCIAL - RESTAURANTES SEM HORÁRIOS CONFIGURADOS:
--   6) Se um restaurante NÃO TEM registros em restaurant_hours,
--      ele deve ser considerado "SEM RESTRIÇÃO DE HORÁRIO" (sempre aberto)
--      NÃO mostrar como "fechado"!
--   7) Apenas restaurantes COM horários configurados são verificados
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
-- A) VERIFICAR SE RESTAURANTE TEM HORÁRIOS CONFIGURADOS
-- =====================================================================
-- Esta é a primeira verificação! Se não tem horários, considerar ABERTO
has_hours_configured AS (
  SELECT EXISTS (
    SELECT 1 FROM mesaclik.restaurant_hours rh
    CROSS JOIN params p
    WHERE rh.restaurant_id = p.restaurant_id
  ) AS has_hours
),

-- =====================================================================
-- B) HORÁRIOS REGULARES DA SEMANA (todos os 7 dias)
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
SELECT 
  hc.has_hours AS restaurante_tem_horarios_configurados,
  rh.*
FROM has_hours_configured hc
LEFT JOIN regular_hours rh ON true;

-- =====================================================================
-- C) VERIFICAR SE ESTÁ ABERTO HOJE (com todas as regras)
-- =====================================================================
-- Descomente para usar:
/*
WITH params AS (
  SELECT
    'b01b96fb-bd8c-46d6-b168-b4d11ffdd208'::uuid AS restaurant_id,
    CURRENT_DATE AS target_date,
    EXTRACT(DOW FROM CURRENT_DATE)::int AS today_dow
),
-- Primeiro: verificar se tem horários configurados
has_hours AS (
  SELECT EXISTS (
    SELECT 1 FROM mesaclik.restaurant_hours rh
    CROSS JOIN params p
    WHERE rh.restaurant_id = p.restaurant_id
  ) AS configured
),
-- Verificar se há fechamento extraordinário
closure_check AS (
  SELECT EXISTS (
    SELECT 1 FROM mesaclik.restaurant_closures rc
    CROSS JOIN params p
    WHERE rc.restaurant_id = p.restaurant_id
      AND rc.date = p.target_date
  ) AS is_closed_today
),
-- Verificar se há data especial
special_date AS (
  SELECT 
    rsd.open_time,
    rsd.close_time,
    rsd.reason
  FROM mesaclik.restaurant_special_dates rsd
  CROSS JOIN params p
  WHERE rsd.restaurant_id = p.restaurant_id
    AND rsd.date = p.target_date
  LIMIT 1
),
-- Horário regular do dia
regular_today AS (
  SELECT 
    rh.open_time,
    rh.close_time
  FROM mesaclik.restaurant_hours rh
  CROSS JOIN params p
  WHERE rh.restaurant_id = p.restaurant_id
    AND rh.day_of_week = p.today_dow
  LIMIT 1
)
SELECT
  p.target_date,
  p.today_dow,
  hh.configured AS tem_horarios_configurados,
  cc.is_closed_today,
  CASE
    -- Se não tem horários configurados = SEM RESTRIÇÃO (aberto)
    WHEN NOT hh.configured THEN 'ABERTO (sem restrição de horário)'
    -- Se tem fechamento extraordinário = fechado
    WHEN cc.is_closed_today THEN 'FECHADO (fechamento extraordinário)'
    -- Se tem horário especial = usar esse
    WHEN sd.open_time IS NOT NULL THEN 
      'ABERTO (horário especial): ' || sd.open_time::text || ' - ' || sd.close_time::text
    -- Se tem horário regular = usar esse
    WHEN rt.open_time IS NOT NULL THEN 
      'ABERTO: ' || rt.open_time::text || ' - ' || rt.close_time::text
    -- Tem horários configurados mas o dia está sem horário = fechado
    ELSE 'FECHADO (sem horário para hoje)'
  END AS status_hoje,
  COALESCE(sd.open_time, rt.open_time) AS open_time,
  COALESCE(sd.close_time, rt.close_time) AS close_time
FROM params p
CROSS JOIN has_hours hh
CROSS JOIN closure_check cc
LEFT JOIN special_date sd ON true
LEFT JOIN regular_today rt ON true;
*/

-- =====================================================================
-- D) FUNÇÃO PARA O APP: is_restaurant_open(restaurant_id, check_time)
-- =====================================================================
-- O Cursor/Flutter deve implementar esta lógica:
--
-- function isRestaurantOpen(restaurantId, checkTime = now()) {
--   // 1. Verificar se tem horários configurados
--   const hours = await getRestaurantHours(restaurantId);
--   
--   // ⚠️ SE NÃO TEM HORÁRIOS = ABERTO (sem restrição)
--   if (hours.length === 0) {
--     return { isOpen: true, reason: 'no_restrictions' };
--   }
--   
--   // 2. Verificar fechamento extraordinário
--   const closure = await getClosureForDate(restaurantId, checkTime.date);
--   if (closure) {
--     return { isOpen: false, reason: 'closure', detail: closure.reason };
--   }
--   
--   // 3. Verificar data especial
--   const specialDate = await getSpecialDate(restaurantId, checkTime.date);
--   if (specialDate) {
--     const isWithinHours = checkTime.time >= specialDate.open && checkTime.time <= specialDate.close;
--     return { isOpen: isWithinHours, reason: 'special_date' };
--   }
--   
--   // 4. Verificar horário regular
--   const dayOfWeek = checkTime.weekday; // 0=Dom, 6=Sáb
--   const regularHours = hours.find(h => h.day_of_week === dayOfWeek);
--   
--   if (!regularHours || !regularHours.open_time) {
--     return { isOpen: false, reason: 'closed_today' };
--   }
--   
--   const isWithinHours = checkTime.time >= regularHours.open_time && checkTime.time <= regularHours.close_time;
--   return { isOpen: isWithinHours, reason: 'regular_hours' };
-- }
--

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
--
-- mesaclik.restaurant_closures:
--   id (uuid, PK)
--   restaurant_id (uuid, FK)
--   date (date)
--   reason (text, nullable)
--   created_at, updated_at

-- =============================================================================
-- CANONICAL SQL: Calendário de Disponibilidade de Reservas
-- =============================================================================
-- Este arquivo é a fonte de verdade para consultar dias disponíveis/indisponíveis
-- para reservas no Flutter App.
-- 
-- TABELA: mesaclik.restaurant_calendar
-- COLUNAS:
--   - restaurant_id (UUID): ID do restaurante
--   - day (DATE): Data específica (ex: 2024-12-17)
--   - is_open (BOOLEAN): true = disponível, false = indisponível
--   - created_at, updated_at (TIMESTAMPTZ)
--
-- REGRA DE NEGÓCIO:
--   - Se um dia NÃO está na tabela, ele é DISPONÍVEL por padrão
--   - Se um dia está na tabela com is_open = false, ele é INDISPONÍVEL
--   - Se um dia está na tabela com is_open = true, ele é DISPONÍVEL
-- =============================================================================

-- Query 1: Buscar todos os dias bloqueados (indisponíveis) para um restaurante
-- Use esta query para marcar dias vermelhos/indisponíveis no calendário do app
WITH params AS (
  SELECT 
    '00000000-0000-0000-0000-000000000000'::uuid AS restaurant_id -- Substituir pelo ID real
)
SELECT 
  rc.day,
  rc.is_open,
  rc.updated_at
FROM mesaclik.restaurant_calendar rc
JOIN params p ON rc.restaurant_id = p.restaurant_id
WHERE rc.is_open = false
ORDER BY rc.day ASC;

-- Query 2: Verificar se uma data específica está disponível
-- Retorna true se disponível, false se bloqueado
WITH params AS (
  SELECT 
    '00000000-0000-0000-0000-000000000000'::uuid AS restaurant_id, -- Substituir
    '2024-12-25'::date AS target_date -- Substituir pela data a verificar
)
SELECT 
  COALESCE(
    (SELECT rc.is_open 
     FROM mesaclik.restaurant_calendar rc
     JOIN params p ON rc.restaurant_id = p.restaurant_id AND rc.day = p.target_date),
    true -- Se não existe registro, dia está DISPONÍVEL por padrão
  ) AS is_available;

-- Query 3: Buscar disponibilidade de um mês inteiro
-- Retorna todos os dias do mês com status de disponibilidade
WITH params AS (
  SELECT 
    '00000000-0000-0000-0000-000000000000'::uuid AS restaurant_id, -- Substituir
    2024 AS year,
    12 AS month
),
days_of_month AS (
  SELECT generate_series(
    make_date(p.year, p.month, 1),
    (make_date(p.year, p.month, 1) + interval '1 month - 1 day')::date,
    '1 day'::interval
  )::date AS day
  FROM params p
)
SELECT 
  d.day,
  COALESCE(rc.is_open, true) AS is_available,
  CASE 
    WHEN rc.is_open = false THEN 'blocked'
    WHEN rc.is_open = true THEN 'available'
    ELSE 'default_available'
  END AS status
FROM days_of_month d
LEFT JOIN mesaclik.restaurant_calendar rc 
  ON rc.day = d.day 
  AND rc.restaurant_id = (SELECT restaurant_id FROM params)
ORDER BY d.day ASC;

-- =============================================================================
-- IMPLEMENTAÇÃO DART/FLUTTER
-- =============================================================================
-- 
-- // Função para buscar dias bloqueados
-- Future<List<DateTime>> getBlockedDates(String restaurantId) async {
--   final response = await supabase
--       .schema('mesaclik')
--       .from('restaurant_calendar')
--       .select('day')
--       .eq('restaurant_id', restaurantId)
--       .eq('is_open', false);
--   
--   return (response as List)
--       .map((row) => DateTime.parse(row['day']))
--       .toList();
-- }
-- 
-- // Função para verificar se uma data está disponível
-- bool isDateAvailable(DateTime date, List<DateTime> blockedDates) {
--   return !blockedDates.any((blocked) => 
--     blocked.year == date.year && 
--     blocked.month == date.month && 
--     blocked.day == date.day
--   );
-- }
--
-- =============================================================================

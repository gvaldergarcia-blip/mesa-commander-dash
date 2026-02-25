
CREATE OR REPLACE FUNCTION mesaclik.get_queue_wait_time_averages_enhanced(
  p_restaurant_id UUID
)
RETURNS TABLE (
  size_range TEXT,
  avg_wait_time_min INTEGER,
  sample_count BIGINT,
  period TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = mesaclik, public
AS $$
BEGIN
  -- Today's data
  RETURN QUERY
  WITH today_entries AS (
    SELECT 
      qe.party_size,
      COALESCE(
        qe.wait_time_min,
        ROUND(EXTRACT(EPOCH FROM (qe.seated_at - qe.created_at)) / 60)::integer
      ) as calc_wait,
      CASE 
        WHEN qe.party_size BETWEEN 1 AND 2 THEN '1-2'
        WHEN qe.party_size BETWEEN 3 AND 4 THEN '3-4'
        WHEN qe.party_size BETWEEN 5 AND 6 THEN '5-6'
        WHEN qe.party_size BETWEEN 7 AND 8 THEN '7-8'
        WHEN qe.party_size BETWEEN 9 AND 10 THEN '9-10'
        ELSE '10+'
      END as sr
    FROM mesaclik.queue_entries qe
    JOIN mesaclik.queues q ON qe.queue_id = q.id
    WHERE q.restaurant_id = p_restaurant_id
      AND qe.status = 'seated'
      AND qe.seated_at IS NOT NULL
      AND qe.created_at >= DATE_TRUNC('day', NOW())
  )
  SELECT 
    te.sr,
    ROUND(AVG(te.calc_wait))::integer,
    COUNT(*),
    'today'::TEXT
  FROM today_entries te
  WHERE te.calc_wait > 0
  GROUP BY te.sr;

  -- Historical data (last 7 days, excluding today)
  RETURN QUERY
  WITH hist_entries AS (
    SELECT 
      qe.party_size,
      COALESCE(
        qe.wait_time_min,
        ROUND(EXTRACT(EPOCH FROM (qe.seated_at - qe.created_at)) / 60)::integer
      ) as calc_wait,
      CASE 
        WHEN qe.party_size BETWEEN 1 AND 2 THEN '1-2'
        WHEN qe.party_size BETWEEN 3 AND 4 THEN '3-4'
        WHEN qe.party_size BETWEEN 5 AND 6 THEN '5-6'
        WHEN qe.party_size BETWEEN 7 AND 8 THEN '7-8'
        WHEN qe.party_size BETWEEN 9 AND 10 THEN '9-10'
        ELSE '10+'
      END as sr
    FROM mesaclik.queue_entries qe
    JOIN mesaclik.queues q ON qe.queue_id = q.id
    WHERE q.restaurant_id = p_restaurant_id
      AND qe.status = 'seated'
      AND qe.seated_at IS NOT NULL
      AND qe.created_at >= NOW() - INTERVAL '7 days'
      AND qe.created_at < DATE_TRUNC('day', NOW())
  )
  SELECT 
    he.sr,
    ROUND(AVG(he.calc_wait))::integer,
    COUNT(*),
    'historical'::TEXT
  FROM hist_entries he
  WHERE he.calc_wait > 0
  GROUP BY he.sr;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION mesaclik.get_queue_wait_time_averages_enhanced(UUID) TO anon, authenticated;

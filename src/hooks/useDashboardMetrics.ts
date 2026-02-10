import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

export interface DashboardMetrics {
  people_in_queue: number;
  groups_in_queue: number;
  reservations_today: number;
  served_today: number;
  called_today: number;
  canceled_today: number;
}

export function useDashboardMetrics() {
  const { restaurantId } = useRestaurant();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    people_in_queue: 0,
    groups_in_queue: 0,
    reservations_today: 0,
    served_today: 0,
    called_today: 0,
    canceled_today: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .schema('mesaclik')
        .from('v_dashboard_kpis')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw error;

      setMetrics(data || {
        people_in_queue: 0,
        groups_in_queue: 0,
        reservations_today: 0,
        served_today: 0,
        called_today: 0,
        canceled_today: 0,
      });
    } catch (err) {
      console.error('Erro ao buscar métricas:', err);
      setMetrics({
        people_in_queue: 0,
        groups_in_queue: 0,
        reservations_today: 0,
        served_today: 0,
        called_today: 0,
        canceled_today: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchMetrics();

    const queueChannel = supabase
      .channel('queue-metrics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'mesaclik', table: 'queue_entries' },
        () => { fetchMetrics(); }
      )
      .subscribe();

    const reservationsChannel = supabase
      .channel('reservations-metrics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'mesaclik', table: 'reservations' },
        () => { fetchMetrics(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, [fetchMetrics]);

  return { metrics, loading, refetch: fetchMetrics };
}

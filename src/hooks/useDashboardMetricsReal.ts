import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { useQueueRealtime } from './useQueueRealtime';
import { useReservationsRealtime } from './useReservationsRealtime';

type DashboardMetrics = {
  peopleInQueue: number;
  groupsInQueue: number;
  reservationsToday: number;
  servedToday: number;
  calledToday: number;
  canceledToday: number;
  avgWaitTimeMinutes: number | null;
  weeklyGrowth: number;
};

export function useDashboardMetricsReal() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    peopleInQueue: 0,
    groupsInQueue: 0,
    reservationsToday: 0,
    servedToday: 0,
    calledToday: 0,
    canceledToday: 0,
    avgWaitTimeMinutes: null,
    weeklyGrowth: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);

      // 1. KPIs básicos da view
      const { data: kpis, error: kpiError } = await supabase
        .schema('mesaclik')
        .from('v_dashboard_kpis')
        .select('*')
        .single();

      if (kpiError) throw kpiError;

      // 2. Calcular tempo médio de espera REAL
      // Média de (seated_at - created_at) para status='seated' hoje
      const { data: seatedToday, error: seatedError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('created_at, seated_at')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'seated')
        .gte('seated_at', new Date().toISOString().split('T')[0]) // Hoje
        .not('seated_at', 'is', null);

      if (seatedError) throw seatedError;

      let avgWaitTimeMinutes: number | null = null;
      if (seatedToday && seatedToday.length > 0) {
        const totalMinutes = seatedToday.reduce((sum, entry) => {
          const created = new Date(entry.created_at).getTime();
          const seated = new Date(entry.seated_at!).getTime();
          const diffMinutes = (seated - created) / 60000;
          return sum + diffMinutes;
        }, 0);
        avgWaitTimeMinutes = Math.round(totalMinutes / seatedToday.length);
      }

      // 3. Crescimento semanal (reservas)
      const today = new Date();
      const startOfThisWeek = new Date(today);
      startOfThisWeek.setDate(today.getDate() - today.getDay());
      startOfThisWeek.setHours(0, 0, 0, 0);

      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

      const { count: thisWeekCount } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', startOfThisWeek.toISOString());

      const { count: lastWeekCount } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', startOfLastWeek.toISOString())
        .lt('created_at', startOfThisWeek.toISOString());

      let weeklyGrowth = 0;
      if (lastWeekCount && lastWeekCount > 0) {
        weeklyGrowth = Math.round(((thisWeekCount || 0) - lastWeekCount) / lastWeekCount * 100);
      } else if (thisWeekCount && thisWeekCount > 0) {
        weeklyGrowth = 100;
      }

      setMetrics({
        peopleInQueue: kpis?.people_in_queue || 0,
        groupsInQueue: kpis?.groups_in_queue || 0,
        reservationsToday: kpis?.reservations_today || 0,
        servedToday: kpis?.served_today || 0,
        calledToday: kpis?.called_today || 0,
        canceledToday: kpis?.canceled_today || 0,
        avgWaitTimeMinutes,
        weeklyGrowth,
      });
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Realtime
  useQueueRealtime(fetchMetrics);
  useReservationsRealtime(fetchMetrics);

  return { metrics, loading, refetch: fetchMetrics };
}

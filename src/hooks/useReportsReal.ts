import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';

type ReportMetrics = {
  // KPIs principais
  avgWaitTime: { current: number; trend: number };
  conversionRate: { current: number; trend: number };
  noShowRate: { current: number; trend: number };
  newCustomers: number;
  vipCustomers: number;
  
  // Métricas de fila
  queueMetrics: Array<{
    period: string;
    avgWait: number;
    totalServed: number;
    peaked: string;
  }>;
  queueEfficiency: number;
  avgQueueSize: number;
  
  // Métricas de reservas
  reservationMetrics: Array<{
    period: string;
    confirmed: number;
    pending: number;
    noShow: number;
  }>;
};

export function useReportsReal() {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Tempo médio de espera (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: queueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('created_at, seated_at')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'seated')
        .gte('seated_at', thirtyDaysAgo.toISOString())
        .not('seated_at', 'is', null);

      let avgWaitTime = 0;
      if (queueData && queueData.length > 0) {
        const totalMinutes = queueData.reduce((sum, entry) => {
          const created = new Date(entry.created_at).getTime();
          const seated = new Date(entry.seated_at!).getTime();
          return sum + (seated - created) / 60000;
        }, 0);
        avgWaitTime = Math.round(totalMinutes / queueData.length);
      }

      // 2. Taxa de conversão (reservas confirmadas / total)
      const { count: totalReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: confirmedReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'confirmed')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const conversionRate = totalReservations && totalReservations > 0
        ? Math.round((confirmedReservations || 0) / totalReservations * 100)
        : 0;

      // 3. Taxa de no-show
      const { count: noShowCount } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'no_show')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const noShowRate = totalReservations && totalReservations > 0
        ? Math.round((noShowCount || 0) / totalReservations * 100)
        : 0;

      // 4. Clientes novos e VIP
      const { data: customers } = await supabase
        .schema('mesaclik')
        .from('v_customers')
        .select('*');

      const now = new Date();
      const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const newCustomers = customers?.filter(c => 
        new Date(c.last_visit_at) >= thirtyDaysAgoDate
      ).length || 0;
      
      const vipCustomers = customers?.filter(c => c.vip_status).length || 0;

      // 5. Métricas de fila por período (última semana)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: weekQueueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('created_at, seated_at, status')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', sevenDaysAgo.toISOString());

      const queueMetrics = [
        {
          period: 'Últimos 7 dias',
          avgWait: avgWaitTime,
          totalServed: weekQueueData?.filter(e => e.status === 'seated').length || 0,
          peaked: '19:00 - 21:00',
        },
      ];

      // 6. Eficiência da fila
      const servedCount = weekQueueData?.filter(e => e.status === 'seated').length || 0;
      const canceledCount = weekQueueData?.filter(e => e.status === 'canceled').length || 0;
      const queueEfficiency = servedCount + canceledCount > 0
        ? Math.round((servedCount / (servedCount + canceledCount)) * 100)
        : 100;

      // 7. Métricas de reservas
      const { data: weekReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('status')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', sevenDaysAgo.toISOString());

      const reservationMetrics = [
        {
          period: 'Últimos 7 dias',
          confirmed: weekReservations?.filter(r => r.status === 'confirmed').length || 0,
          pending: weekReservations?.filter(r => r.status === 'pending').length || 0,
          noShow: weekReservations?.filter(r => r.status === 'no_show').length || 0,
        },
      ];

      setMetrics({
        avgWaitTime: { current: avgWaitTime, trend: 0 },
        conversionRate: { current: conversionRate, trend: 0 },
        noShowRate: { current: noShowRate, trend: 0 },
        newCustomers,
        vipCustomers,
        queueMetrics,
        queueEfficiency,
        avgQueueSize: Math.round((weekQueueData?.length || 0) / 7),
        reservationMetrics,
      });
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return { metrics, loading, refetch: fetchReports };
}

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

type PeriodType = 'today' | '7days' | '30days' | '90days';

export function useReportsReal(period: PeriodType = '30days') {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);

      // Calcular datas baseado no período
      const endDate = new Date();
      const startDate = new Date();
      
      if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === '7days') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === '30days') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (period === '90days') {
        startDate.setDate(startDate.getDate() - 90);
      }

      // 1. Tempo médio de espera
      const { data: queueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('created_at, seated_at')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'seated')
        .gte('seated_at', startDate.toISOString())
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
        .gte('created_at', startDate.toISOString());

      const { count: confirmedReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .in('status', ['confirmed', 'completed', 'seated'])
        .gte('created_at', startDate.toISOString());

      const conversionRate = totalReservations && totalReservations > 0
        ? Math.round((confirmedReservations || 0) / totalReservations * 100)
        : 0;

      // 3. Taxa de no-show
      const { count: noShowCount } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'canceled')
        .gte('created_at', startDate.toISOString());

      const noShowRate = totalReservations && totalReservations > 0
        ? Math.round((noShowCount || 0) / totalReservations * 100)
        : 0;

      // 4. Clientes novos e VIP
      const { data: customers } = await supabase
        .schema('mesaclik')
        .from('v_customers')
        .select('*');

      const newCustomers = customers?.filter(c => 
        new Date(c.last_visit_at) >= startDate
      ).length || 0;
      
      const vipCustomers = customers?.filter(c => c.vip_status).length || 0;

      // 5. Métricas de fila por período
      const { data: periodQueueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('created_at, seated_at, status')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', startDate.toISOString());

      const queueMetrics = [
        {
          period: period === 'today' ? 'Hoje' : period === '7days' ? 'Últimos 7 dias' : period === '30days' ? 'Últimos 30 dias' : 'Últimos 90 dias',
          avgWait: avgWaitTime,
          totalServed: periodQueueData?.filter(e => e.status === 'seated').length || 0,
          peaked: '19:00 - 21:00',
        },
      ];

      // 6. Eficiência da fila
      const servedCount = periodQueueData?.filter(e => e.status === 'seated').length || 0;
      const canceledCount = periodQueueData?.filter(e => e.status === 'canceled').length || 0;
      const queueEfficiency = servedCount + canceledCount > 0
        ? Math.round((servedCount / (servedCount + canceledCount)) * 100)
        : 100;

      // 7. Métricas de reservas
      const { data: periodReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('status')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', startDate.toISOString());

      const reservationMetrics = [
        {
          period: period === 'today' ? 'Hoje' : period === '7days' ? 'Últimos 7 dias' : period === '30days' ? 'Últimos 30 dias' : 'Últimos 90 dias',
          confirmed: periodReservations?.filter(r => r.status === 'confirmed' || r.status === 'completed').length || 0,
          pending: periodReservations?.filter(r => r.status === 'pending').length || 0,
          noShow: periodReservations?.filter(r => r.status === 'canceled').length || 0,
        },
      ];

      const days = period === 'today' ? 1 : period === '7days' ? 7 : period === '30days' ? 30 : 90;

      setMetrics({
        avgWaitTime: { current: avgWaitTime, trend: 0 },
        conversionRate: { current: conversionRate, trend: 0 },
        noShowRate: { current: noShowRate, trend: 0 },
        newCustomers,
        vipCustomers,
        queueMetrics,
        queueEfficiency,
        avgQueueSize: Math.round((periodQueueData?.length || 0) / days),
        reservationMetrics,
      });
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return { metrics, loading, refetch: fetchReports };
}

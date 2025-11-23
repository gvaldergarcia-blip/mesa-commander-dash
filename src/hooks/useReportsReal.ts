import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { useQueueRealtime } from './useQueueRealtime';
import { useReservationsRealtime } from './useReservationsRealtime';

type ReportMetrics = {
  // KPIs principais com comparativo
  avgWaitTime: { current: number; previous: number; trend: number };
  conversionRate: { current: number; previous: number; trend: number };
  noShowRate: { current: number; previous: number; trend: number };
  cancelRate: { current: number; previous: number; trend: number };
  avgPartySize: { current: number; previous: number; trend: number };
  
  // Métricas complementares
  newCustomers: number;
  vipCustomers: number;
  totalServed: number;
  totalCanceled: number;
  peakHour: string;
  peakDay: string;
  
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
    canceled: number;
  }>;
  
  // Dados para gráficos
  dailyEvolution: Array<{
    date: string;
    reservations: number;
    queue: number;
  }>;
  statusDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  hourlyDistribution: Array<{
    hour: string;
    count: number;
  }>;
};

type PeriodType = 'today' | '7days' | '30days' | '90days';
type SourceType = 'all' | 'queue' | 'reservations';

export function useReportsReal(period: PeriodType = '30days', sourceType: SourceType = 'all') {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);

      // Calcular datas do período atual e anterior
      const endDate = new Date();
      const startDate = new Date();
      const previousStartDate = new Date();
      const previousEndDate = new Date();
      
      const days = period === 'today' ? 1 : period === '7days' ? 7 : period === '30days' ? 30 : 90;
      
      if (period === 'today') {
        startDate.setHours(0, 0, 0, 0);
        previousEndDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(previousStartDate.getDate() - 1);
        previousStartDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(startDate.getDate() - days);
        previousEndDate.setTime(startDate.getTime());
        previousStartDate.setDate(previousStartDate.getDate() - (days * 2));
      }

      // PERÍODO ATUAL - Dados de fila
      const { data: currentQueueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('created_at, seated_at, status, party_size, phone')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // PERÍODO ANTERIOR - Dados de fila
      const { data: previousQueueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('created_at, seated_at, status, party_size')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', previousEndDate.toISOString());

      // PERÍODO ATUAL - Dados de reservas
      const { data: currentReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('created_at, reserved_for, status, party_size, phone')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('reserved_for', startDate.toISOString())
        .lte('reserved_for', endDate.toISOString());

      // PERÍODO ANTERIOR - Dados de reservas
      const { data: previousReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('created_at, reserved_for, status, party_size')
        .eq('restaurant_id', RESTAURANT_ID)
        .gte('reserved_for', previousStartDate.toISOString())
        .lt('reserved_for', previousEndDate.toISOString());

      // Filtrar por tipo de origem
      const filterBySource = <T extends { }>(queue: T[] | null, reservations: T[] | null): T[] => {
        if (sourceType === 'queue') return queue || [];
        if (sourceType === 'reservations') return reservations || [];
        return [...(queue || []), ...(reservations || [])];
      };

      // 1. TEMPO MÉDIO DE ESPERA (apenas fila)
      const calcAvgWait = (data: any[] | null) => {
        const seated = data?.filter(e => e.status === 'seated' && e.seated_at) || [];
        if (seated.length === 0) return 0;
        const total = seated.reduce((sum, e) => {
          const diff = new Date(e.seated_at).getTime() - new Date(e.created_at).getTime();
          return sum + diff / 60000;
        }, 0);
        return Math.round(total / seated.length);
      };

      const currentAvgWait = calcAvgWait(currentQueueData);
      const previousAvgWait = calcAvgWait(previousQueueData);
      const waitTrend = previousAvgWait > 0 ? Math.round(((currentAvgWait - previousAvgWait) / previousAvgWait) * 100) : 0;

      // 2. TAXA DE CONVERSÃO (reservas)
      const currentTotal = currentReservations?.length || 0;
      const currentConfirmed = currentReservations?.filter(r => 
        ['confirmed', 'completed', 'seated'].includes(r.status)
      ).length || 0;
      const previousTotal = previousReservations?.length || 0;
      const previousConfirmed = previousReservations?.filter(r => 
        ['confirmed', 'completed', 'seated'].includes(r.status)
      ).length || 0;

      const currentConvRate = currentTotal > 0 ? Math.round((currentConfirmed / currentTotal) * 100) : 0;
      const previousConvRate = previousTotal > 0 ? Math.round((previousConfirmed / previousTotal) * 100) : 0;
      const convTrend = previousConvRate > 0 ? Math.round(((currentConvRate - previousConvRate) / previousConvRate) * 100) : 0;

      // 3. TAXA DE NO-SHOW
      const currentNoShow = currentReservations?.filter(r => r.status === 'canceled').length || 0;
      const previousNoShow = previousReservations?.filter(r => r.status === 'canceled').length || 0;
      const currentNoShowRate = currentTotal > 0 ? Math.round((currentNoShow / currentTotal) * 100) : 0;
      const previousNoShowRate = previousTotal > 0 ? Math.round((previousNoShow / previousTotal) * 100) : 0;
      const noShowTrend = previousNoShowRate > 0 ? Math.round(((currentNoShowRate - previousNoShowRate) / previousNoShowRate) * 100) : 0;

      // 4. TAXA DE CANCELAMENTO (fila)
      const currentCanceled = currentQueueData?.filter(e => e.status === 'canceled').length || 0;
      const previousCanceled = previousQueueData?.filter(e => e.status === 'canceled').length || 0;
      const currentCancelRate = (currentQueueData?.length || 0) > 0 ? Math.round((currentCanceled / (currentQueueData?.length || 1)) * 100) : 0;
      const previousCancelRate = (previousQueueData?.length || 0) > 0 ? Math.round((previousCanceled / (previousQueueData?.length || 1)) * 100) : 0;
      const cancelTrend = previousCancelRate > 0 ? Math.round(((currentCancelRate - previousCancelRate) / previousCancelRate) * 100) : 0;

      // 5. MÉDIA DE PESSOAS POR GRUPO
      const calcAvgParty = (queue: any[] | null, reservations: any[] | null) => {
        const all = filterBySource(queue, reservations);
        if (all.length === 0) return 0;
        const total = all.reduce((sum, e) => sum + (e.party_size || 0), 0);
        return Math.round((total / all.length) * 10) / 10;
      };

      const currentAvgParty = calcAvgParty(currentQueueData, currentReservations);
      const previousAvgParty = calcAvgParty(previousQueueData, previousReservations);
      const partyTrend = previousAvgParty > 0 ? Math.round(((currentAvgParty - previousAvgParty) / previousAvgParty) * 100) : 0;

      // 6. CLIENTES NOVOS E VIP
      const { data: customers } = await supabase
        .schema('mesaclik')
        .from('v_customers')
        .select('*');

      const newCustomers = customers?.filter(c => 
        new Date(c.last_visit_at) >= startDate
      ).length || 0;
      
      const vipCustomers = customers?.filter(c => c.vip_status).length || 0;

      // 7. HORÁRIO E DIA DE PICO
      const hourCounts: { [key: string]: number } = {};
      const dayCounts: { [key: string]: number } = {};

      currentQueueData?.forEach(e => {
        const date = new Date(e.created_at);
        const hour = date.getHours();
        const day = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });

      currentReservations?.forEach(r => {
        const date = new Date(r.reserved_for);
        const hour = date.getHours();
        const day = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });

      const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '19';
      const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sábado';

      // 8. EVOLUÇÃO DIÁRIA
      const dailyMap: { [key: string]: { reservations: number; queue: number } } = {};
      
      currentReservations?.forEach(r => {
        const date = new Date(r.reserved_for).toLocaleDateString('pt-BR');
        if (!dailyMap[date]) dailyMap[date] = { reservations: 0, queue: 0 };
        dailyMap[date].reservations++;
      });

      currentQueueData?.forEach(e => {
        const date = new Date(e.created_at).toLocaleDateString('pt-BR');
        if (!dailyMap[date]) dailyMap[date] = { reservations: 0, queue: 0 };
        dailyMap[date].queue++;
      });

      const dailyEvolution = Object.entries(dailyMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime())
        .slice(-30); // Últimos 30 dias

      // 9. DISTRIBUIÇÃO DE STATUS (Pizza)
      const statusDistribution = [
        { name: 'Confirmadas', value: currentConfirmed, color: 'hsl(var(--success))' },
        { name: 'Pendentes', value: currentReservations?.filter(r => r.status === 'pending').length || 0, color: 'hsl(var(--warning))' },
        { name: 'Canceladas', value: currentNoShow, color: 'hsl(var(--destructive))' },
        { name: 'Atendidos (Fila)', value: currentQueueData?.filter(e => e.status === 'seated').length || 0, color: 'hsl(var(--primary))' }
      ].filter(s => s.value > 0);

      // 10. DISTRIBUIÇÃO HORÁRIA
      const hourlyDistribution = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

      // 11. MÉTRICAS DETALHADAS
      const queueMetrics = [{
        period: period === 'today' ? 'Hoje' : `Últimos ${days} dias`,
        avgWait: currentAvgWait,
        totalServed: currentQueueData?.filter(e => e.status === 'seated').length || 0,
        peaked: `${peakHour}:00`,
      }];

      const servedCount = currentQueueData?.filter(e => e.status === 'seated').length || 0;
      const queueEfficiency = (currentQueueData?.length || 0) > 0
        ? Math.round((servedCount / (currentQueueData?.length || 1)) * 100)
        : 100;

      const reservationMetrics = [{
        period: period === 'today' ? 'Hoje' : `Últimos ${days} dias`,
        confirmed: currentConfirmed,
        pending: currentReservations?.filter(r => r.status === 'pending').length || 0,
        noShow: currentNoShow,
        canceled: currentCanceled,
      }];

      setMetrics({
        avgWaitTime: { current: currentAvgWait, previous: previousAvgWait, trend: waitTrend },
        conversionRate: { current: currentConvRate, previous: previousConvRate, trend: convTrend },
        noShowRate: { current: currentNoShowRate, previous: previousNoShowRate, trend: noShowTrend },
        cancelRate: { current: currentCancelRate, previous: previousCancelRate, trend: cancelTrend },
        avgPartySize: { current: currentAvgParty, previous: previousAvgParty, trend: partyTrend },
        newCustomers,
        vipCustomers,
        totalServed: servedCount,
        totalCanceled: currentCanceled,
        peakHour: `${peakHour}:00`,
        peakDay,
        queueMetrics,
        queueEfficiency,
        avgQueueSize: Math.round((currentQueueData?.length || 0) / days),
        reservationMetrics,
        dailyEvolution,
        statusDistribution,
        hourlyDistribution,
      });
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
    }
  }, [period, sourceType]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Realtime updates
  useQueueRealtime(fetchReports);
  useReservationsRealtime(fetchReports);

  return { metrics, loading, refetch: fetchReports };
}

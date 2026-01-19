import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { useQueueRealtime } from './useQueueRealtime';
import { useReservationsRealtime } from './useReservationsRealtime';

/**
 * DOCUMENTAÇÃO DAS MÉTRICAS - useReportsReal
 * 
 * Todas as métricas são calculadas APENAS a partir de dados reais do banco.
 * 
 * STATUS DISPONÍVEIS:
 * - Fila (queue_entries): waiting, called, seated, canceled
 * - Reservas (reservations): pending, confirmed, seated, completed, canceled, no_show
 * 
 * FÓRMULAS:
 * 
 * 1. Tempo Médio de Espera (Fila):
 *    Média de (seated_at - created_at) para entries com status='seated' e seated_at preenchido
 * 
 * 2. Taxa de Conversão (Fila):
 *    (entries com status='seated' / total de entries) × 100
 *    Representa: % de clientes que entraram na fila e foram efetivamente atendidos
 * 
 * 3. Taxa de Não Comparecimento (Reservas):
 *    (reservas com status='no_show' / (reservas com status in ('completed','seated','no_show','canceled'))) × 100
 *    Se não houver status no_show, usa reservas canceladas como proxy
 * 
 * 4. Taxa de Cancelamento (Fila + Reservas):
 *    (cancelados / total de registros) × 100
 * 
 * 5. Média por Grupo:
 *    Média de party_size de todos os registros atendidos (seated/completed)
 * 
 * 6. Eficiência da Fila:
 *    (entries seated / total entries) × 100
 * 
 * 7. Horário de Pico:
 *    Hora com maior volume de created_at (entradas)
 * 
 * 8. Dia de Pico:
 *    Dia da semana com maior volume de created_at (entradas)
 */

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
  
  // Última atualização
  lastUpdated: string;
};

type PeriodType = 'today' | '7days' | '30days' | '90days';
type SourceType = 'all' | 'queue' | 'reservations';

export function useReportsReal(period: PeriodType = '30days', sourceType: SourceType = 'all') {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);

      // Calcular datas do período atual e anterior (timezone Brasil)
      const now = new Date();
      const endDate = new Date(now);
      const startDate = new Date(now);
      const previousStartDate = new Date(now);
      const previousEndDate = new Date(now);
      
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

      // ============================================
      // PERÍODO ATUAL - Dados de fila
      // ============================================
      const { data: currentQueueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('id, created_at, called_at, seated_at, canceled_at, status, party_size, phone')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // ============================================
      // PERÍODO ANTERIOR - Dados de fila
      // ============================================
      const { data: previousQueueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('id, created_at, called_at, seated_at, canceled_at, status, party_size')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', previousEndDate.toISOString());

      // ============================================
      // PERÍODO ATUAL - Dados de reservas
      // ============================================
      const { data: currentReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('id, created_at, reserved_for, confirmed_at, completed_at, canceled_at, no_show_at, status, party_size, phone')
        .gte('reserved_for', startDate.toISOString())
        .lte('reserved_for', endDate.toISOString());

      // ============================================
      // PERÍODO ANTERIOR - Dados de reservas
      // ============================================
      const { data: previousReservations } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('id, created_at, reserved_for, confirmed_at, completed_at, canceled_at, no_show_at, status, party_size')
        .gte('reserved_for', previousStartDate.toISOString())
        .lt('reserved_for', previousEndDate.toISOString());

      // ============================================
      // 1. TEMPO MÉDIO DE ESPERA (apenas fila)
      // Fórmula: Média de (seated_at - created_at) para status='seated'
      // ============================================
      const calcAvgWait = (data: any[] | null) => {
        if (!data) return 0;
        const seatedWithTimestamp = data.filter(e => e.status === 'seated' && e.seated_at);
        if (seatedWithTimestamp.length === 0) return 0;
        
        const total = seatedWithTimestamp.reduce((sum, e) => {
          const diff = new Date(e.seated_at).getTime() - new Date(e.created_at).getTime();
          return sum + Math.max(0, diff / 60000); // Evitar valores negativos
        }, 0);
        return Math.round(total / seatedWithTimestamp.length);
      };

      const currentAvgWait = calcAvgWait(currentQueueData);
      const previousAvgWait = calcAvgWait(previousQueueData);
      const waitTrend = previousAvgWait > 0 
        ? Math.round(((currentAvgWait - previousAvgWait) / previousAvgWait) * 100) 
        : 0;

      // ============================================
      // 2. TAXA DE CONVERSÃO (Fila)
      // Fórmula: (seated / total_entries) × 100
      // Representa % de clientes que foram efetivamente atendidos
      // ============================================
      const calcQueueConversion = (data: any[] | null) => {
        if (!data || data.length === 0) return 0;
        const seated = data.filter(e => e.status === 'seated').length;
        return Math.round((seated / data.length) * 100);
      };

      const currentQueueConv = calcQueueConversion(currentQueueData);
      const previousQueueConv = calcQueueConversion(previousQueueData);
      const convTrend = previousQueueConv > 0 
        ? Math.round(((currentQueueConv - previousQueueConv) / previousQueueConv) * 100) 
        : 0;

      // ============================================
      // 3. TAXA DE NÃO COMPARECIMENTO (Reservas)
      // Fórmula: (no_show / finalizadas) × 100
      // Onde finalizadas = completed + seated + no_show + canceled
      // Se não houver status no_show, essa métrica fica zerada
      // ============================================
      const calcNoShowRate = (data: any[] | null) => {
        if (!data || data.length === 0) return 0;
        
        // Verificar se há reservas com status 'no_show' ou no_show_at preenchido
        const noShowCount = data.filter(r => 
          r.status === 'no_show' || r.no_show_at !== null
        ).length;
        
        // Base: reservas que tiveram um desfecho (não estão mais pendentes)
        const finalizedCount = data.filter(r => 
          ['completed', 'seated', 'no_show', 'canceled'].includes(r.status) || 
          r.completed_at !== null || 
          r.no_show_at !== null
        ).length;
        
        if (finalizedCount === 0) return 0;
        return Math.round((noShowCount / finalizedCount) * 100);
      };

      const currentNoShowRate = calcNoShowRate(currentReservations);
      const previousNoShowRate = calcNoShowRate(previousReservations);
      const noShowTrend = previousNoShowRate > 0 
        ? Math.round(((currentNoShowRate - previousNoShowRate) / previousNoShowRate) * 100) 
        : 0;

      // ============================================
      // 4. TAXA DE CANCELAMENTO (Fila + Reservas)
      // Fórmula: (cancelados / total) × 100
      // ============================================
      const calcCancelRate = (queueData: any[] | null, resData: any[] | null, source: SourceType) => {
        let total = 0;
        let canceled = 0;
        
        if (source !== 'reservations' && queueData) {
          total += queueData.length;
          canceled += queueData.filter(e => e.status === 'canceled').length;
        }
        
        if (source !== 'queue' && resData) {
          total += resData.length;
          canceled += resData.filter(r => r.status === 'canceled').length;
        }
        
        if (total === 0) return 0;
        return Math.round((canceled / total) * 100);
      };

      const currentCancelRate = calcCancelRate(currentQueueData, currentReservations, sourceType);
      const previousCancelRate = calcCancelRate(previousQueueData, previousReservations, sourceType);
      const cancelTrend = previousCancelRate > 0 
        ? Math.round(((currentCancelRate - previousCancelRate) / previousCancelRate) * 100) 
        : 0;

      // ============================================
      // 5. MÉDIA DE PESSOAS POR GRUPO (atendidos)
      // Fórmula: Média de party_size dos status finalizados com sucesso
      // ============================================
      const calcAvgParty = (queueData: any[] | null, resData: any[] | null, source: SourceType) => {
        const served: any[] = [];
        
        if (source !== 'reservations' && queueData) {
          served.push(...queueData.filter(e => e.status === 'seated'));
        }
        
        if (source !== 'queue' && resData) {
          served.push(...resData.filter(r => ['completed', 'seated'].includes(r.status)));
        }
        
        if (served.length === 0) return 0;
        const total = served.reduce((sum, e) => sum + (e.party_size || 0), 0);
        return Math.round((total / served.length) * 10) / 10;
      };

      const currentAvgParty = calcAvgParty(currentQueueData, currentReservations, sourceType);
      const previousAvgParty = calcAvgParty(previousQueueData, previousReservations, sourceType);
      const partyTrend = previousAvgParty > 0 
        ? Math.round(((currentAvgParty - previousAvgParty) / previousAvgParty) * 100) 
        : 0;

      // ============================================
      // 6. CLIENTES NOVOS E VIP
      // Novos: primeira visita no período
      // VIP: 5+ visitas no total
      // ============================================
      const { data: customers } = await supabase
        .schema('mesaclik')
        .from('customers')
        .select('id, total_visits, vip_status, first_visit_at');

      // Clientes que tiveram primeira visita no período analisado
      const newCustomers = customers?.filter(c => {
        if (!c.first_visit_at) return false;
        const firstVisit = new Date(c.first_visit_at);
        return firstVisit >= startDate && firstVisit <= endDate;
      }).length || 0;
      
      // Clientes com 5+ visitas
      const vipCustomers = customers?.filter(c => 
        c.vip_status === true || (c.total_visits && c.total_visits >= 5)
      ).length || 0;

      // ============================================
      // 7. HORÁRIO E DIA DE PICO (baseado em entradas)
      // ============================================
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

      const peakHourEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
      const peakHour = peakHourEntry ? `${peakHourEntry[0]}:00` : '-';
      
      const peakDayEntry = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
      const peakDay = peakDayEntry ? peakDayEntry[0] : '-';

      // ============================================
      // 8. EVOLUÇÃO DIÁRIA
      // ============================================
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
        .sort((a, b) => {
          const dateA = a.date.split('/').reverse().join('-');
          const dateB = b.date.split('/').reverse().join('-');
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        })
        .slice(-30);

      // ============================================
      // 9. DISTRIBUIÇÃO DE STATUS (Pizza)
      // ============================================
      const queueSeated = currentQueueData?.filter(e => e.status === 'seated').length || 0;
      const queueCanceled = currentQueueData?.filter(e => e.status === 'canceled').length || 0;
      const queueWaiting = currentQueueData?.filter(e => e.status === 'waiting').length || 0;
      const queueCalled = currentQueueData?.filter(e => e.status === 'called').length || 0;
      
      const resCompleted = currentReservations?.filter(r => ['completed', 'seated'].includes(r.status)).length || 0;
      const resPending = currentReservations?.filter(r => r.status === 'pending').length || 0;
      const resCanceled = currentReservations?.filter(r => r.status === 'canceled').length || 0;
      const resNoShow = currentReservations?.filter(r => r.status === 'no_show' || r.no_show_at).length || 0;
      
      const statusDistribution = [
        { name: 'Atendidos (Fila)', value: queueSeated, color: 'hsl(var(--success))' },
        { name: 'Concluídas (Reserva)', value: resCompleted, color: 'hsl(var(--primary))' },
        { name: 'Aguardando', value: queueWaiting + queueCalled, color: 'hsl(var(--warning))' },
        { name: 'Pendentes', value: resPending, color: 'hsl(var(--muted-foreground))' },
        { name: 'Cancelados', value: queueCanceled + resCanceled, color: 'hsl(var(--destructive))' },
        { name: 'Não Compareceram', value: resNoShow, color: 'hsl(var(--destructive) / 0.7)' },
      ].filter(s => s.value > 0);

      // ============================================
      // 10. DISTRIBUIÇÃO HORÁRIA
      // ============================================
      const hourlyDistribution = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: `${hour.padStart(2, '0')}:00`, count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

      // ============================================
      // 11. MÉTRICAS DETALHADAS
      // ============================================
      const totalServed = queueSeated + resCompleted;
      const totalCanceled = queueCanceled + resCanceled;
      
      const queueMetrics = [{
        period: period === 'today' ? 'Hoje' : `Últimos ${days} dias`,
        avgWait: currentAvgWait,
        totalServed: queueSeated,
        peaked: peakHour,
      }];

      const queueEfficiency = (currentQueueData?.length || 0) > 0
        ? Math.round((queueSeated / (currentQueueData?.length || 1)) * 100)
        : 0;

      const reservationMetrics = [{
        period: period === 'today' ? 'Hoje' : `Últimos ${days} dias`,
        confirmed: resCompleted,
        pending: resPending,
        noShow: resNoShow,
        canceled: resCanceled,
      }];

      // ============================================
      // RESULTADO FINAL
      // ============================================
      setMetrics({
        avgWaitTime: { current: currentAvgWait, previous: previousAvgWait, trend: waitTrend },
        conversionRate: { current: currentQueueConv, previous: previousQueueConv, trend: convTrend },
        noShowRate: { current: currentNoShowRate, previous: previousNoShowRate, trend: noShowTrend },
        cancelRate: { current: currentCancelRate, previous: previousCancelRate, trend: cancelTrend },
        avgPartySize: { current: currentAvgParty, previous: previousAvgParty, trend: partyTrend },
        newCustomers,
        vipCustomers,
        totalServed,
        totalCanceled,
        peakHour,
        peakDay,
        queueMetrics,
        queueEfficiency,
        avgQueueSize: Math.round((currentQueueData?.length || 0) / Math.max(days, 1)),
        reservationMetrics,
        dailyEvolution,
        statusDistribution,
        hourlyDistribution,
        lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
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

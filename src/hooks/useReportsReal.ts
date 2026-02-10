import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useQueueRealtime } from './useQueueRealtime';
import { useReservationsRealtime } from './useReservationsRealtime';

/**
 * DOCUMENTAÇÃO DAS MÉTRICAS - useReportsReal (REFATORADO PREMIUM)
 * 
 * PRINCÍPIOS:
 * 1. Separação clara: Métricas de FILA e RESERVA são calculadas independentemente
 * 2. Tempo de espera: APENAS para fila (entrada → seated_at)
 * 3. No-show: APENAS para reservas (status='no_show' ou no_show_at preenchido)
 * 4. Dados reais: Todos os números derivados de timestamps reais do banco
 * 5. Fuso horário: Brasília (UTC-3)
 */

export type ReportMetrics = {
  // === MÉTRICAS GERAIS ===
  totalServed: number;
  totalCanceled: number;
  peakHour: string;
  peakDay: string;
  avgPartySize: number;
  newCustomers: number;
  vipCustomers: number;
  lastUpdated: string;
  
  // === MÉTRICAS EXCLUSIVAS DE FILA ===
  queue: {
    avgWaitTime: number;        // Tempo médio entrada → seated_at (minutos)
    avgWaitTimePrevious: number;
    conversionRate: number;     // % atendidos / total entradas
    conversionRatePrevious: number;
    totalEntries: number;
    seated: number;
    waiting: number;
    called: number;
    canceled: number;
    noShow: number;
    avgQueueSize: number;       // Média diária
    hourlyDistribution: Array<{ hour: string; count: number }>;
    hasData: boolean;
  };
  
  // === MÉTRICAS EXCLUSIVAS DE RESERVAS ===
  reservations: {
    completed: number;
    confirmed: number;
    pending: number;
    canceled: number;
    noShow: number;
    noShowRate: number;         // % no-show / finalizadas
    noShowRatePrevious: number;
    successRate: number;        // % concluídas+confirmadas / total
    totalReservations: number;
    hasData: boolean;
  };
  
  // === GRÁFICOS COMBINADOS (quando filtro = 'all') ===
  dailyEvolution: Array<{
    date: string;
    reservations: number;
    queue: number;
  }>;
};

type PeriodType = 'today' | '7days' | '30days' | '90days';
type SourceType = 'all' | 'queue' | 'reservations';

export function useReportsReal(period: PeriodType = '30days', sourceType: SourceType = 'all') {
  const { restaurantId } = useRestaurant();
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef({ hasInitialData: false });

  const fetchReports = useCallback(async () => {
    try {
      if (!stateRef.current.hasInitialData) {
        setLoading(true);
      }

      // Calcular datas do período atual e anterior
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
      // BUSCAR DADOS VIA RPC (bypassa RLS)
      // ============================================
      const [
        { data: currentQueueData },
        { data: previousQueueData },
        { data: currentReservations },
        { data: previousReservations },
        { data: customers }
      ] = await Promise.all([
        supabase.rpc('get_reports_queue_data', {
          p_restaurant_id: restaurantId,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString()
        }),
        supabase.rpc('get_reports_queue_data', {
          p_restaurant_id: restaurantId,
          p_start_date: previousStartDate.toISOString(),
          p_end_date: previousEndDate.toISOString()
        }),
        supabase.rpc('get_reports_reservation_data', {
          p_restaurant_id: restaurantId,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString()
        }),
        supabase.rpc('get_reports_reservation_data', {
          p_restaurant_id: restaurantId,
          p_start_date: previousStartDate.toISOString(),
          p_end_date: previousEndDate.toISOString()
        }),
        supabase.from('customers').select('id, total_visits, vip_status, created_at')
      ]);

      // ============================================
      // 1. MÉTRICAS DE FILA (EXCLUSIVO)
      // ============================================
      
      // Tempo médio de espera: entrada → seated_at
      const calcAvgWait = (data: any[] | null) => {
        if (!data) return 0;
        const seatedWithTimestamp = data.filter(e => 
          ['seated', 'served'].includes(e.status) && e.seated_at
        );
        if (seatedWithTimestamp.length === 0) return 0;
        
        const total = seatedWithTimestamp.reduce((sum, e) => {
          const diff = new Date(e.seated_at).getTime() - new Date(e.created_at).getTime();
          return sum + Math.max(0, diff / 60000);
        }, 0);
        return Math.round(total / seatedWithTimestamp.length);
      };

      const queueSeated = currentQueueData?.filter((e: any) => ['seated', 'served'].includes(e.status)).length || 0;
      const queueWaiting = currentQueueData?.filter((e: any) => e.status === 'waiting').length || 0;
      const queueCalled = currentQueueData?.filter((e: any) => e.status === 'called').length || 0;
      const queueCanceled = currentQueueData?.filter((e: any) => e.status === 'canceled').length || 0;
      const queueNoShow = currentQueueData?.filter((e: any) => e.status === 'no_show').length || 0;
      const totalQueueEntries = currentQueueData?.length || 0;

      const currentAvgWait = calcAvgWait(currentQueueData);
      const previousAvgWait = calcAvgWait(previousQueueData);

      const currentQueueConv = totalQueueEntries > 0 ? Math.round((queueSeated / totalQueueEntries) * 100) : 0;
      const prevQueueSeated = previousQueueData?.filter((e: any) => ['seated', 'served'].includes(e.status)).length || 0;
      const prevQueueTotal = previousQueueData?.length || 0;
      const previousQueueConv = prevQueueTotal > 0 ? Math.round((prevQueueSeated / prevQueueTotal) * 100) : 0;

      // Distribuição horária (APENAS FILA)
      const hourCounts: { [key: string]: number } = {};
      currentQueueData?.forEach((e: any) => {
        const date = new Date(e.created_at);
        const hour = date.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const hourlyDistribution = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: `${hour.padStart(2, '0')}:00`, count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

      // ============================================
      // 2. MÉTRICAS DE RESERVAS (EXCLUSIVO)
      // ============================================
      const resCompleted = currentReservations?.filter((r: any) => r.status === 'completed').length || 0;
      const resConfirmed = currentReservations?.filter((r: any) => r.status === 'confirmed').length || 0;
      const resPending = currentReservations?.filter((r: any) => r.status === 'pending').length || 0;
      const resCanceled = currentReservations?.filter((r: any) => r.status === 'canceled').length || 0;
      const resNoShow = currentReservations?.filter((r: any) => r.status === 'no_show' || r.no_show_at).length || 0;
      const totalReservations = currentReservations?.length || 0;

      // No-show rate (apenas reservas finalizadas)
      const resFinalized = resCompleted + resNoShow + resCanceled;
      const noShowRate = resFinalized > 0 ? Math.round((resNoShow / resFinalized) * 100) : 0;
      
      const prevResNoShow = previousReservations?.filter((r: any) => r.status === 'no_show' || r.no_show_at).length || 0;
      const prevResFinalized = (previousReservations?.filter((r: any) => 
        ['completed', 'no_show', 'canceled'].includes(r.status)
      ).length || 0);
      const prevNoShowRate = prevResFinalized > 0 ? Math.round((prevResNoShow / prevResFinalized) * 100) : 0;

      const successRate = totalReservations > 0 
        ? Math.round(((resCompleted + resConfirmed) / totalReservations) * 100) 
        : 0;

      // ============================================
      // 3. MÉTRICAS COMBINADAS
      // ============================================
      const dayCounts: { [key: string]: number } = {};
      
      currentQueueData?.forEach((e: any) => {
        const day = new Date(e.created_at).toLocaleDateString('pt-BR', { weekday: 'long' });
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      currentReservations?.forEach((r: any) => {
        const day = new Date(r.reserved_for).toLocaleDateString('pt-BR', { weekday: 'long' });
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });

      const peakHourEntry = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
      const peakHour = peakHourEntry ? `${peakHourEntry[0].padStart(2, '0')}:00` : '-';
      
      const peakDayEntry = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
      const peakDay = peakDayEntry ? peakDayEntry[0] : '-';

      // Evolução diária
      const dailyMap: { [key: string]: { reservations: number; queue: number } } = {};
      
      currentReservations?.forEach((r: any) => {
        const date = new Date(r.reserved_for).toLocaleDateString('pt-BR');
        if (!dailyMap[date]) dailyMap[date] = { reservations: 0, queue: 0 };
        dailyMap[date].reservations++;
      });
      currentQueueData?.forEach((e: any) => {
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

      // Média de pessoas por grupo (atendidos)
      const allServed = [
        ...(currentQueueData?.filter((e: any) => ['seated', 'served'].includes(e.status)) || []),
        ...(currentReservations?.filter((r: any) => r.status === 'completed') || [])
      ];
      const avgPartySize = allServed.length > 0
        ? Math.round((allServed.reduce((sum, e) => sum + (e.party_size || 0), 0) / allServed.length) * 10) / 10
        : 0;

      // Clientes
      const newCustomers = customers?.filter(c => {
        if (!c.created_at) return false;
        const createdAt = new Date(c.created_at);
        return createdAt >= startDate && createdAt <= endDate;
      }).length || 0;
      
      const vipCustomers = customers?.filter(c => 
        c.vip_status === true || (c.total_visits && c.total_visits >= 10)
      ).length || 0;

      // ============================================
      // RESULTADO FINAL
      // ============================================
      setMetrics({
        totalServed: queueSeated + resCompleted,
        totalCanceled: queueCanceled + resCanceled,
        peakHour,
        peakDay,
        avgPartySize,
        newCustomers,
        vipCustomers,
        lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        
        queue: {
          avgWaitTime: currentAvgWait,
          avgWaitTimePrevious: previousAvgWait,
          conversionRate: currentQueueConv,
          conversionRatePrevious: previousQueueConv,
          totalEntries: totalQueueEntries,
          seated: queueSeated,
          waiting: queueWaiting,
          called: queueCalled,
          canceled: queueCanceled,
          noShow: queueNoShow,
          avgQueueSize: Math.round(totalQueueEntries / Math.max(days, 1)),
          hourlyDistribution,
          hasData: totalQueueEntries > 0,
        },
        
        reservations: {
          completed: resCompleted,
          confirmed: resConfirmed,
          pending: resPending,
          canceled: resCanceled,
          noShow: resNoShow,
          noShowRate,
          noShowRatePrevious: prevNoShowRate,
          successRate,
          totalReservations,
          hasData: totalReservations > 0,
        },
        
        dailyEvolution,
      });

      stateRef.current.hasInitialData = true;
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
    }
  }, [period, sourceType, restaurantId]);

  useEffect(() => {
    stateRef.current.hasInitialData = false;
  }, [period, sourceType]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useQueueRealtime(fetchReports);
  useReservationsRealtime(fetchReports);

  return { metrics, loading, refetch: fetchReports };
}

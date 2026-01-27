import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { useQueueRealtime } from './useQueueRealtime';
import { useReservationsRealtime } from './useReservationsRealtime';

type RpcQueueEntry = {
  entry_id: string;
  queue_id: string;
  customer_name: string;
  phone: string;
  email?: string;
  people: number;
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show';
  notes?: string | null;
  position?: number | null;
  called_at?: string | null;
  seated_at?: string | null;
  canceled_at?: string | null;
  created_at: string;
  updated_at: string;
};

type RpcReservationRow = {
  id: string;
  status: string;
  party_size: number;
  phone: string;
  created_at: string;
  reserved_for: string;
  confirmed_at: string | null;
  canceled_at: string | null;
  completed_at: string | null;
  no_show_at: string | null;
};

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

export type RecentActivityItem = {
  id: string;
  type: 'queue' | 'reservation';
  customer: string;
  action: string;
  time: string;
  timestamp: Date;
  party: number;
  status: string;
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
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);

      // Data de hoje no formato correto
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      
      const todayStartISO = todayStart.toISOString();
      const todayEndISO = todayEnd.toISOString();

      const isBetween = (iso: string | null | undefined) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= todayStart.getTime() && t < todayEnd.getTime();
      };

      // Buscar fila via RPC (bypassa RLS e já traz dados reais)
      const { data: queueEntries, error: queueRpcError } = await supabase
        .schema('mesaclik')
        .rpc('get_queue_entries', {
          p_restaurant_id: RESTAURANT_ID,
          // 48h para não perder entradas que foram criadas ontem mas tiveram atualização hoje
          p_hours_back: 48,
        });

      if (queueRpcError) throw queueRpcError;

      const queueData = (queueEntries || []) as RpcQueueEntry[];

      // KPIs de fila (estado atual)
      const waitingNow = queueData.filter((e) => e.status === 'waiting');
      const groupsInQueue = waitingNow.length;
      const peopleInQueue = waitingNow.reduce((sum, e) => sum + (e.people || 0), 0);

      // Eventos do dia (baseados nos timestamps corretos)
      const calledToday = queueData.filter((e) => e.status === 'called' && isBetween(e.called_at)).length;
      const seatedQueueToday = queueData.filter((e) => e.status === 'seated' && isBetween(e.seated_at)).length;
      const canceledQueueToday = queueData.filter(
        (e) => (e.status === 'canceled' || e.status === 'no_show') && isBetween(e.canceled_at)
      ).length;

      // Tempo médio de espera (somente seated HOJE)
      let avgWaitTimeMinutes: number | null = null;
      const seatedToday = queueData.filter((e) => e.status === 'seated' && isBetween(e.seated_at));
      if (seatedToday.length > 0) {
        const totalMinutes = seatedToday.reduce((sum, e) => {
          const created = new Date(e.created_at).getTime();
          const seated = new Date(e.seated_at as string).getTime();
          const diffMinutes = (seated - created) / 60000;
          return sum + diffMinutes;
        }, 0);
        avgWaitTimeMinutes = Math.round(totalMinutes / seatedToday.length);
      }

      // Reservas do dia via RPC (public schema)
      const { data: reservationsRpc, error: reservationsRpcError } = await supabase
        .schema('public')
        .rpc('get_reports_reservation_data', {
          p_restaurant_id: RESTAURANT_ID,
          p_start_date: todayStartISO,
          p_end_date: todayEndISO,
        });

      if (reservationsRpcError) throw reservationsRpcError;

      const reservationsData = (reservationsRpc || []) as RpcReservationRow[];

      const reservationsToday = reservationsData.filter((r) => r.status === 'pending' || r.status === 'confirmed').length;
      const completedReservationsToday = reservationsData.filter((r) => r.status === 'completed' && isBetween(r.completed_at)).length;

      // Total atendidos = sentados na fila + reservas concluídas
      const servedToday = seatedQueueToday + completedReservationsToday;

      // 8. Crescimento semanal (reservas)
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

      // 9. ATIVIDADE RECENTE - Usar dados da RPC já carregada (queueData) + reservationsData
      // Filtrar entradas da fila com atividade hoje
      const queueActivityToday = queueData.filter((e) => {
        return isBetween(e.created_at) || isBetween(e.called_at) || isBetween(e.seated_at) || isBetween(e.canceled_at);
      }).slice(0, 15);

      // Filtrar reservas com atividade hoje
      const reservationActivityToday = reservationsData.filter((r) => {
        return isBetween(r.created_at) || isBetween(r.confirmed_at) || isBetween(r.completed_at) || isBetween(r.canceled_at);
      }).slice(0, 15);

      // Montar feed de atividade
      const activityItems: RecentActivityItem[] = [];

      // Adicionar eventos da fila
      for (const entry of queueActivityToday) {
        const statusMap: Record<string, string> = {
          'waiting': 'Adicionado à fila',
          'called': 'Chamado para mesa',
          'seated': 'Sentado',
          'canceled': 'Cancelado',
          'no_show': 'Não compareceu'
        };

        // Determinar timestamp baseado no status
        let timestamp: Date;
        if (entry.status === 'seated' && entry.seated_at) {
          timestamp = new Date(entry.seated_at);
        } else if (entry.status === 'called' && entry.called_at) {
          timestamp = new Date(entry.called_at);
        } else if (entry.status === 'canceled' && entry.canceled_at) {
          timestamp = new Date(entry.canceled_at);
        } else {
          timestamp = new Date(entry.updated_at || entry.created_at);
        }

        activityItems.push({
          id: `queue-${entry.entry_id}`,
          type: 'queue',
          customer: entry.customer_name || 'Cliente',
          action: statusMap[entry.status] || entry.status,
          time: timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          timestamp,
          party: entry.people || 0,
          status: entry.status
        });
      }

      // Adicionar eventos de reservas
      for (const res of reservationActivityToday) {
        const statusMap: Record<string, string> = {
          'pending': 'Reserva pendente',
          'confirmed': 'Reserva confirmada',
          'completed': 'Reserva concluída',
          'canceled': 'Reserva cancelada',
          'no_show': 'Não compareceu'
        };

        // Determinar timestamp baseado no status
        let timestamp: Date;
        if (res.status === 'confirmed' && res.confirmed_at) {
          timestamp = new Date(res.confirmed_at);
        } else if (res.status === 'completed' && res.completed_at) {
          timestamp = new Date(res.completed_at);
        } else if (res.status === 'canceled' && res.canceled_at) {
          timestamp = new Date(res.canceled_at);
        } else {
          timestamp = new Date(res.created_at);
        }

        activityItems.push({
          id: `res-${res.id}`,
          type: 'reservation',
          customer: 'Cliente',
          action: statusMap[res.status] || res.status,
          time: timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          timestamp,
          party: res.party_size || 0,
          status: res.status
        });
      }

      // Ordenar por timestamp decrescente e limitar
      activityItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setRecentActivity(activityItems.slice(0, 20));

      setMetrics({
        peopleInQueue,
        groupsInQueue,
        reservationsToday,
        servedToday,
        calledToday,
        canceledToday: canceledQueueToday,
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

  // Fallback de "tempo real" caso o Realtime esteja instável (CHANNEL_ERROR)
  useEffect(() => {
    const id = window.setInterval(() => {
      fetchMetrics();
    }, 15000);
    return () => window.clearInterval(id);
  }, [fetchMetrics]);

  // Realtime
  useQueueRealtime(fetchMetrics);
  useReservationsRealtime(fetchMetrics);

  return { metrics, recentActivity, loading, refetch: fetchMetrics };
}

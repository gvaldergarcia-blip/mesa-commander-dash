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

      // 1. GRUPOS NA FILA - status = 'waiting' criados HOJE
      const { data: waitingQueue, error: waitingError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('id, party_size')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'waiting')
        .gte('created_at', todayStartISO)
        .lt('created_at', todayEndISO);

      if (waitingError) throw waitingError;

      const groupsInQueue = waitingQueue?.length || 0;
      const peopleInQueue = waitingQueue?.reduce((sum, entry) => sum + (entry.party_size || 0), 0) || 0;

      // 2. CHAMADOS HOJE - status = 'called' HOJE
      const { count: calledCount, error: calledError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'called')
        .gte('created_at', todayStartISO)
        .lt('created_at', todayEndISO);

      if (calledError) throw calledError;

      // 3. ATENDIDOS HOJE (sentados na fila) - status = 'seated' HOJE
      const { count: seatedQueueCount, error: seatedQueueError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'seated')
        .gte('seated_at', todayStartISO)
        .lt('seated_at', todayEndISO);

      if (seatedQueueError) throw seatedQueueError;

      // 4. RESERVAS HOJE - reserved_for = HOJE e status in ('pending', 'confirmed')
      const { count: reservationsCount, error: reservationsError } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .in('status', ['pending', 'confirmed'])
        .gte('reserved_for', todayStartISO)
        .lt('reserved_for', todayEndISO);

      if (reservationsError) throw reservationsError;

      // 5. RESERVAS CONCLUÍDAS HOJE - status = 'completed' HOJE
      const { count: completedReservationsCount, error: completedError } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'completed')
        .gte('completed_at', todayStartISO)
        .lt('completed_at', todayEndISO);

      if (completedError) throw completedError;

      // 6. CANCELADOS HOJE (fila)
      const { count: canceledQueueCount, error: canceledQueueError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', RESTAURANT_ID)
        .in('status', ['canceled', 'no_show'])
        .gte('created_at', todayStartISO)
        .lt('created_at', todayEndISO);

      if (canceledQueueError) throw canceledQueueError;

      // Total atendidos = sentados na fila + reservas concluídas
      const servedToday = (seatedQueueCount || 0) + (completedReservationsCount || 0);

      // 7. Calcular tempo médio de espera REAL (seated hoje)
      const { data: seatedTodayData, error: seatedDataError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('created_at, seated_at')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'seated')
        .gte('seated_at', todayStartISO)
        .lt('seated_at', todayEndISO)
        .not('seated_at', 'is', null);

      if (seatedDataError) throw seatedDataError;

      let avgWaitTimeMinutes: number | null = null;
      if (seatedTodayData && seatedTodayData.length > 0) {
        const totalMinutes = seatedTodayData.reduce((sum, entry) => {
          const created = new Date(entry.created_at).getTime();
          const seated = new Date(entry.seated_at!).getTime();
          const diffMinutes = (seated - created) / 60000;
          return sum + diffMinutes;
        }, 0);
        avgWaitTimeMinutes = Math.round(totalMinutes / seatedTodayData.length);
      }

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

      // 9. ATIVIDADE RECENTE - Somente eventos de HOJE
      const [queueActivity, reservationActivity] = await Promise.all([
        // Eventos da fila hoje
        supabase
          .schema('mesaclik')
          .from('queue_entries')
          .select('id, name, party_size, status, created_at, updated_at, called_at, seated_at, canceled_at')
          .eq('restaurant_id', RESTAURANT_ID)
          .gte('created_at', todayStartISO)
          .lt('created_at', todayEndISO)
          .order('updated_at', { ascending: false })
          .limit(15),
        
        // Eventos de reservas hoje
        supabase
          .schema('mesaclik')
          .from('reservations')
          .select('id, name, party_size, status, created_at, updated_at, confirmed_at, completed_at, canceled_at, reserved_for')
          .eq('restaurant_id', RESTAURANT_ID)
          .or(`created_at.gte.${todayStartISO},updated_at.gte.${todayStartISO}`)
          .order('updated_at', { ascending: false })
          .limit(15)
      ]);

      // Montar feed de atividade
      const activityItems: RecentActivityItem[] = [];

      // Adicionar eventos da fila
      if (queueActivity.data) {
        for (const entry of queueActivity.data) {
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
            id: `queue-${entry.id}`,
            type: 'queue',
            customer: entry.name || 'Cliente',
            action: statusMap[entry.status] || entry.status,
            time: timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            timestamp,
            party: entry.party_size || 0,
            status: entry.status
          });
        }
      }

      // Adicionar eventos de reservas
      if (reservationActivity.data) {
        for (const res of reservationActivity.data) {
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
            timestamp = new Date(res.updated_at || res.created_at);
          }

          activityItems.push({
            id: `res-${res.id}`,
            type: 'reservation',
            customer: res.name || 'Cliente',
            action: statusMap[res.status] || res.status,
            time: timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            timestamp,
            party: res.party_size || 0,
            status: res.status
          });
        }
      }

      // Ordenar por timestamp decrescente e limitar
      activityItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setRecentActivity(activityItems.slice(0, 20));

      setMetrics({
        peopleInQueue,
        groupsInQueue,
        reservationsToday: reservationsCount || 0,
        servedToday,
        calledToday: calledCount || 0,
        canceledToday: canceledQueueCount || 0,
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

  return { metrics, recentActivity, loading, refetch: fetchMetrics };
}

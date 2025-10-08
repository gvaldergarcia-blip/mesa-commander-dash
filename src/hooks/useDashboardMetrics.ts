import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';

export interface DashboardMetrics {
  queueWaiting: number;
  queueTotalPeople: number;
  avgWaitTime: number;
  reservationsToday: number;
  reservationsConfirmed: number;
  reservationsPending: number;
  totalPeopleToday: number;
  queueSeatedToday: number;
  queueCanceledToday: number;
  queueCalledNow: number;
}

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    queueWaiting: 0,
    queueTotalPeople: 0,
    avgWaitTime: 0,
    reservationsToday: 0,
    reservationsConfirmed: 0,
    reservationsPending: 0,
    totalPeopleToday: 0,
    queueSeatedToday: 0,
    queueCanceledToday: 0,
    queueCalledNow: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Get active queue for restaurant
      const { data: queues } = await supabase
        .schema('mesaclik')
        .from('queues')
        .select('id')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('is_active', true)
        .limit(1);

      const queueId = queues?.[0]?.id;

      if (queueId) {
        // Queue metrics
        const { data: waitingEntries } = await supabase
          .schema('mesaclik')
          .from('queue_positions')
          .select('party_size, created_at')
          .eq('queue_id', queueId)
          .eq('status', 'waiting');

        const { count: calledCount } = await supabase
          .schema('mesaclik')
          .from('queue_positions')
          .select('*', { count: 'exact', head: true })
          .eq('queue_id', queueId)
          .eq('status', 'called');

        // Today's seated and canceled
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count: seatedToday } = await supabase
          .schema('mesaclik')
          .from('queue_positions')
          .select('*', { count: 'exact', head: true })
          .eq('queue_id', queueId)
          .eq('status', 'seated')
          .gte('seated_at', today.toISOString());

        const { count: canceledToday } = await supabase
          .schema('mesaclik')
          .from('queue_positions')
          .select('*', { count: 'exact', head: true })
          .eq('queue_id', queueId)
          .eq('status', 'canceled')
          .gte('canceled_at', today.toISOString());

        // Calculate avg wait time from seated entries today
        const { data: seatedEntries } = await supabase
          .schema('mesaclik')
          .from('queue_positions')
          .select('created_at, seated_at')
          .eq('queue_id', queueId)
          .eq('status', 'seated')
          .gte('seated_at', today.toISOString())
          .not('seated_at', 'is', null);

        let avgWait = 0;
        if (seatedEntries && seatedEntries.length > 0) {
          const totalWait = seatedEntries.reduce((sum, entry) => {
            const created = new Date(entry.created_at).getTime();
            const seated = new Date(entry.seated_at!).getTime();
            return sum + (seated - created);
          }, 0);
          avgWait = Math.round(totalWait / seatedEntries.length / 60000); // Convert to minutes
        }

        const queueWaiting = waitingEntries?.length || 0;
        const queueTotalPeople = waitingEntries?.reduce((sum, e) => sum + e.party_size, 0) || 0;

        // Reservation metrics
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: reservationsData } = await supabase
          .schema('mesaclik')
          .from('reservations')
          .select('status, party_size')
          .eq('restaurant_id', RESTAURANT_ID)
          .gte('reservation_datetime', today.toISOString())
          .lt('reservation_datetime', tomorrow.toISOString());

        const reservationsToday = reservationsData?.length || 0;
        const reservationsConfirmed = reservationsData?.filter(r => r.status === 'confirmed').length || 0;
        const reservationsPending = reservationsData?.filter(r => r.status === 'pending').length || 0;
        const totalPeopleToday = reservationsData?.reduce((sum, r) => sum + r.party_size, 0) || 0;

        setMetrics({
          queueWaiting,
          queueTotalPeople,
          avgWaitTime: avgWait,
          reservationsToday,
          reservationsConfirmed,
          reservationsPending,
          totalPeopleToday,
          queueSeatedToday: seatedToday || 0,
          queueCanceledToday: canceledToday || 0,
          queueCalledNow: calledCount || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Realtime updates
    const channel = supabase
      .channel('dashboard-metrics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'queue_positions',
        },
        () => {
          fetchMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'reservations',
          filter: `restaurant_id=eq.${RESTAURANT_ID}`
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { metrics, loading, refetch: fetchMetrics };
}

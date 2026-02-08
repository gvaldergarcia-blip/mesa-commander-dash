import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

export function useReservationsRealtime(onUpdate: () => void) {
  const { restaurantId } = useRestaurant();
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!restaurantId) return;
    
    let dbChannel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupChannel = () => {
      // Canal para postgres_changes (atualização via RPC no schema mesaclik)
      dbChannel = supabase
        .channel(`reservations-realtime-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'mesaclik',
            table: 'reservations',
            filter: `restaurant_id=eq.${restaurantId}`
          },
          (payload) => {
            console.log('[useReservationsRealtime] postgres_changes recebido:', payload.eventType);
            onUpdateRef.current();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations',
            filter: `restaurant_id=eq.${restaurantId}`
          },
          (payload) => {
            console.log('[useReservationsRealtime] public schema change:', payload.eventType);
            onUpdateRef.current();
          }
        )
        .subscribe((status) => {
          console.log('[useReservationsRealtime] Subscription status:', status);
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useReservationsRealtime] Channel error, will retry via polling');
          }
        });
    };

    setupChannel();

    // Polling fallback a cada 3 segundos para garantir sincronização
    const pollingInterval = setInterval(() => {
      onUpdateRef.current();
    }, 3000);

    return () => {
      if (dbChannel) {
        supabase.removeChannel(dbChannel);
      }
      clearInterval(pollingInterval);
    };
  }, [restaurantId]);
}

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

import { RESTAURANT_ID } from '@/config/current-restaurant';

export function useReservationsRealtime(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
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
            filter: `restaurant_id=eq.${RESTAURANT_ID}`
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
            filter: `restaurant_id=eq.${RESTAURANT_ID}`
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
  }, []);
}

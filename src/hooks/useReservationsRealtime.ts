import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

import { RESTAURANT_ID } from '@/config/current-restaurant';

export function useReservationsRealtime(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    // Canal para postgres_changes (atualização via RPC no schema mesaclik)
    const dbChannel = supabase
      .channel('reservations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'reservations',
          filter: `restaurant_id=eq.${RESTAURANT_ID}`
        },
        () => {
          console.log('[useReservationsRealtime] postgres_changes recebido');
          onUpdateRef.current();
        }
      )
      .subscribe();

    // Polling fallback a cada 5 segundos para garantir sincronização
    const pollingInterval = setInterval(() => {
      onUpdateRef.current();
    }, 5000);

    return () => {
      supabase.removeChannel(dbChannel);
      clearInterval(pollingInterval);
    };
  }, []);
}

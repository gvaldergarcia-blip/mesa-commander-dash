import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

import { RESTAURANT_ID } from '@/config/current-restaurant';

export function useQueueRealtime(onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('queue-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'queue_entries',
          filter: `restaurant_id=eq.${RESTAURANT_ID}`
        },
        (payload) => {
          // Recarregar apenas se o status for ativo ou mudou de ativo
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          // Se é INSERT/DELETE ou UPDATE que afeta status ativo, atualizar
          if (
            payload.eventType === 'INSERT' ||
            payload.eventType === 'DELETE' ||
            (payload.eventType === 'UPDATE' && (
              ['waiting', 'called'].includes(newRecord?.status) ||
              ['waiting', 'called'].includes(oldRecord?.status)
            ))
          ) {
            onUpdate();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}

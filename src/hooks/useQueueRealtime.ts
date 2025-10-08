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
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}

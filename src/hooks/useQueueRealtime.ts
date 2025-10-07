import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useQueueRealtime(restaurantId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel('queue-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, onUpdate]);
}

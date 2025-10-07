import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useReservationsRealtime(restaurantId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel('reservations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
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

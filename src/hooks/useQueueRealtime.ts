import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

export function useQueueRealtime(onUpdate: () => void) {
  const { restaurantId } = useRestaurant();

  useEffect(() => {
    if (!restaurantId) return;
    
    let channel: ReturnType<typeof supabase.channel> | null = null;

    channel = supabase
      .channel(`queue-realtime-restaurant-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'queue_entries',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('Realtime: mudança na fila detectada', payload.eventType);
          onUpdate();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [onUpdate, restaurantId]);
}

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

export function useQueueRealtime(onUpdate: () => void) {
  const { restaurantId } = useRestaurant();
  const queueIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      // Buscar queue_id do restaurante
      const { data } = await supabase
        .schema('mesaclik')
        .from('queues')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .limit(1)
        .maybeSingle();
      
      if (!data?.id) return;
      
      queueIdRef.current = data.id;

      // Subscrever no canal com o queue_id correto
      channel = supabase
        .channel(`queue-realtime-${data.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'mesaclik',
            table: 'queue_entries',
            filter: `queue_id=eq.${data.id}`
          },
          (payload) => {
            console.log('Realtime: mudança na fila detectada', payload.eventType);
            onUpdate();
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });
    };

    setup();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [onUpdate, restaurantId]);
}

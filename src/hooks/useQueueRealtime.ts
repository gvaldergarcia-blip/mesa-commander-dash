import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';

export function useQueueRealtime(onUpdate: () => void) {
  const [queueId, setQueueId] = useState<string | null>(null);

  // Buscar queue_id do restaurante uma vez
  useEffect(() => {
    const fetchQueueId = async () => {
      const { data } = await supabase
        .schema('mesaclik')
        .from('queues')
        .select('id')
        .eq('restaurant_id', RESTAURANT_ID)
        .limit(1)
        .maybeSingle();
      
      if (data?.id) {
        setQueueId(data.id);
      }
    };
    
    fetchQueueId();
  }, []);

  // Subscrever no canal quando tiver o queue_id
  useEffect(() => {
    if (!queueId) return;

    const channel = supabase
      .channel(`queue-realtime-${queueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'queue_entries',
          filter: `queue_id=eq.${queueId}`
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
      supabase.removeChannel(channel);
    };
  }, [queueId, onUpdate]);
}

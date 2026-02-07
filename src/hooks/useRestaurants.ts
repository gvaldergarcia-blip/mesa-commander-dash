import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Restaurant = Tables<'restaurants'>;

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurants();

    // Realtime subscription for all restaurants
    const channel = supabase
      .channel('restaurants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurants',
        },
        (payload) => {
          console.log('[useRestaurants] Realtime event:', payload.eventType);
          console.log('[useRestaurants] Payload new:', payload.new);
          
          if (payload.eventType === 'INSERT') {
            setRestaurants(prev => [...prev, payload.new as Restaurant]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedRestaurant = payload.new as Restaurant;
            console.log('[useRestaurants] Updating restaurant:', updatedRestaurant.id);
            setRestaurants(prev => {
              const updated = prev.map(r => {
                if (r.id === updatedRestaurant.id) {
                  console.log('[useRestaurants] Found match, updating:', r.name, '->', updatedRestaurant.name);
                  return updatedRestaurant;
                }
                return r;
              });
              console.log('[useRestaurants] New restaurants array:', updated);
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setRestaurants(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      // Buscar apenas o restaurante atual (RESTAURANT_ID do config)
      const { RESTAURANT_ID } = await import('@/config/current-restaurant');
      
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', RESTAURANT_ID)
        .order('name');

      if (error) throw error;
      setRestaurants(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar restaurantes');
    } finally {
      setLoading(false);
    }
  };

  return {
    restaurants,
    loading,
    error,
    refetch: fetchRestaurants
  };
}
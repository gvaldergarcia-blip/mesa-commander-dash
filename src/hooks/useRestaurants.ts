import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import type { Tables } from '@/integrations/supabase/types';

type Restaurant = Tables<'restaurants'>;

export function useRestaurants() {
  const { restaurantId } = useRestaurant();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurants();
    }
  }, [restaurantId]);

  const fetchRestaurants = async () => {
    if (!restaurantId) return;
    
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
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

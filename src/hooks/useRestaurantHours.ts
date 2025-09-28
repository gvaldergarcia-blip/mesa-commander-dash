import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type RestaurantHours = Tables<'restaurant_hours'>;

export function useRestaurantHours(restaurantId?: string) {
  const [hours, setHours] = useState<RestaurantHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId) {
      fetchHours();
    }
  }, [restaurantId]);

  const fetchHours = async () => {
    if (!restaurantId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('day_of_week');

      if (error) throw error;
      setHours(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar horários');
    } finally {
      setLoading(false);
    }
  };

  return {
    hours,
    loading,
    error,
    refetch: fetchHours
  };
}
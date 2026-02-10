import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { FEATURE_FLAGS, FEATURE_DISABLED_MESSAGE } from '@/config/feature-flags';

type Promotion = {
  id: string;
  restaurant_id: string;
  title: string;
  description?: string;
  audience_filter: string;
  starts_at: string;
  ends_at: string;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'canceled';
  created_at: string;
  updated_at: string;
};

export function usePromotions() {
  const { restaurantId } = useRestaurant();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isFeatureEnabled = FEATURE_FLAGS.CUPONS_ENABLED;

  useEffect(() => {
    if (isFeatureEnabled && restaurantId) {
      fetchPromotions();
    } else {
      setLoading(false);
      setPromotions([]);
    }
  }, [isFeatureEnabled, restaurantId]);

  const fetchPromotions = async () => {
    if (!isFeatureEnabled || !restaurantId) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('promotions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPromotions(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar promoções';
      setError(message);
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const createPromotion = async (promotion: Omit<Promotion, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isFeatureEnabled) {
      toast({ title: 'Funcionalidade desativada', description: FEATURE_DISABLED_MESSAGE, variant: 'destructive' });
      throw new Error(FEATURE_DISABLED_MESSAGE);
    }
    try {
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('promotions')
        .insert([promotion])
        .select()
        .single();
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Promoção criada com sucesso' });
      await fetchPromotions();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar promoção';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      throw err;
    }
  };

  return { promotions, loading, error, refetch: fetchPromotions, createPromotion };
}
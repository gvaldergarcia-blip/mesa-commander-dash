import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar promoções';
      setError(message);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createPromotion = async (promotion: Omit<Promotion, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .insert([promotion])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Promoção criada com sucesso',
      });

      await fetchPromotions();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar promoção';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  return {
    promotions,
    loading,
    error,
    refetch: fetchPromotions,
    createPromotion,
  };
}

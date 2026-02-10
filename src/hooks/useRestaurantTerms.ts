import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant } from '@/contexts/RestaurantContext';

export type TermsAcceptance = {
  id: string;
  restaurant_id: string;
  terms_type: string;
  accepted_at: string;
  ip_address?: string;
  user_agent?: string;
  accepted_by?: string;
};

export function useRestaurantTerms() {
  const { restaurantId } = useRestaurant();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (restaurantId) checkTermsAcceptance();
  }, [restaurantId]);

  const checkTermsAcceptance = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('restaurant_terms_acceptance')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('terms_type', 'coupon_publication')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setTermsAccepted(!!data);
    } catch (err) {
      console.error('Erro ao verificar aceite de termos:', err);
      setTermsAccepted(false);
    } finally {
      setLoading(false);
    }
  };

  const acceptTerms = async () => {
    setTermsAccepted(true);
    toast({ title: 'Termos aceitos', description: 'Você pode agora publicar cupons pagos' });
    return true;
  };

  return { termsAccepted, loading, acceptTerms, refetch: checkTermsAcceptance };
}
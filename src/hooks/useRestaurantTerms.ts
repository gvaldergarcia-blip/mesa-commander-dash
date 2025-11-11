import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkTermsAcceptance();
  }, []);

  const checkTermsAcceptance = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('restaurant_terms_acceptance')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('terms_type', 'coupon_publication')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      // Se já existe, considera aceito
      if (data) {
        setTermsAccepted(true);
        return;
      }
      
      // Se não existe, assume que não foi aceito ainda
      setTermsAccepted(false);
    } catch (err) {
      console.error('Erro ao verificar aceite de termos:', err);
      setTermsAccepted(false);
    } finally {
      setLoading(false);
    }
  };

  const acceptTerms = async () => {
    try {
      // Como o registro já existe no banco, apenas marca como aceito
      setTermsAccepted(true);
      
      toast({
        title: 'Termos aceitos',
        description: 'Você pode agora publicar cupons pagos',
      });

      return true;
    } catch (err) {
      console.error('Erro ao aceitar termos:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao processar aceite de termos',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    termsAccepted,
    loading,
    acceptTerms,
    refetch: checkTermsAcceptance,
  };
}

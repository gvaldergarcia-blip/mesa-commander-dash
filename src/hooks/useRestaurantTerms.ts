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
      setTermsAccepted(!!data);
    } catch (err) {
      console.error('Erro ao verificar aceite de termos:', err);
    } finally {
      setLoading(false);
    }
  };

  const acceptTerms = async () => {
    try {
      // Tentar obter usuário autenticado (opcional para o painel admin)
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .schema('mesaclik')
        .from('restaurant_terms_acceptance')
        .insert([{
          restaurant_id: RESTAURANT_ID,
          terms_type: 'coupon_publication',
          ip_address: null,
          user_agent: navigator.userAgent,
          accepted_by: user?.id || null, // Opcional se não houver autenticação
        }]);

      if (error) {
        console.error('Erro ao inserir termos:', error);
        throw error;
      }

      toast({
        title: 'Termos aceitos',
        description: 'Você pode agora publicar cupons pagos',
      });

      setTermsAccepted(true);
      return true;
    } catch (err) {
      console.error('Erro completo ao aceitar termos:', err);
      const message = err instanceof Error ? err.message : 'Erro ao aceitar termos';
      toast({
        title: 'Erro',
        description: message,
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

/**
 * Hook para gerenciar consentimentos LGPD na fila
 * - Termos de Uso + Política de Privacidade (obrigatório)
 * - Opt-in de Marketing (opcional)
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TermsConsent {
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  terms_version: string;
  privacy_version: string;
}

interface MarketingOptin {
  marketing_optin: boolean;
  marketing_optin_at: string | null;
}

interface ConsentState {
  terms: TermsConsent | null;
  marketing: MarketingOptin | null;
  loading: boolean;
  error: string | null;
}

export function useQueueConsent() {
  const [state, setState] = useState<ConsentState>({
    terms: null,
    marketing: null,
    loading: false,
    error: null,
  });

  /**
   * Busca consentimentos existentes para um ticket específico
   */
  const fetchConsents = useCallback(async (
    restaurantId: string,
    ticketId: string,
    customerEmail: string
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Buscar consentimento de termos para este ticket
      const { data: termsData, error: termsError } = await supabase
        .from('queue_terms_consents')
        .select('terms_accepted, terms_accepted_at, terms_version, privacy_version')
        .eq('restaurant_id', restaurantId)
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (termsError && termsError.code !== 'PGRST116') {
        throw termsError;
      }

      // Buscar opt-in de marketing para este cliente/restaurante
      const { data: marketingData, error: marketingError } = await supabase
        .from('restaurant_marketing_optins')
        .select('marketing_optin, marketing_optin_at')
        .eq('restaurant_id', restaurantId)
        .eq('customer_email', customerEmail)
        .maybeSingle();

      if (marketingError && marketingError.code !== 'PGRST116') {
        throw marketingError;
      }

      setState({
        terms: termsData || null,
        marketing: marketingData || null,
        loading: false,
        error: null,
      });

      return {
        termsAccepted: termsData?.terms_accepted || false,
        marketingOptin: marketingData?.marketing_optin || false,
      };
    } catch (err) {
      console.error('Erro ao buscar consentimentos:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Erro ao carregar consentimentos',
      }));
      return { termsAccepted: false, marketingOptin: false };
    }
  }, []);

  /**
   * Salva aceite de termos (obrigatório) e faz upsert no CRM consolidado
   */
  const saveTermsConsent = useCallback(async (
    restaurantId: string,
    ticketId: string,
    customerEmail: string,
    customerName?: string,
    accepted: boolean = true,
    customerPhone?: string,
    marketingOptin?: boolean
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('queue_terms_consents')
        .upsert({
          restaurant_id: restaurantId,
          ticket_id: ticketId,
          customer_email: customerEmail,
          customer_name: customerName || null,
          terms_accepted: accepted,
          terms_accepted_at: accepted ? new Date().toISOString() : null,
          terms_version: 'v1',
          privacy_version: 'v1',
        }, {
          onConflict: 'restaurant_id,ticket_id'
        });

      if (error) {
        console.error('Erro ao salvar consentimento de termos:', error);
        return false;
      }

      // Upsert no CRM consolidado via RPC
      const { error: crmError } = await supabase.rpc('upsert_restaurant_customer', {
        p_restaurant_id: restaurantId,
        p_email: customerEmail,
        p_name: customerName || null,
        p_phone: customerPhone || null,
        p_source: 'queue',
        p_marketing_optin: marketingOptin ?? null,
        p_terms_accepted: accepted,
      });

      if (crmError) {
        console.error('Erro ao salvar no CRM:', crmError);
        // Não falhar se CRM der erro - termos já foram salvos
      }

      setState(prev => ({
        ...prev,
        terms: {
          terms_accepted: accepted,
          terms_accepted_at: accepted ? new Date().toISOString() : null,
          terms_version: 'v1',
          privacy_version: 'v1',
        },
      }));

      return true;
    } catch (err) {
      console.error('Erro ao salvar consentimento de termos:', err);
      return false;
    }
  }, []);

  /**
   * Salva opt-in de marketing (opcional) e atualiza CRM consolidado
   */
  const saveMarketingOptin = useCallback(async (
    restaurantId: string,
    customerEmail: string,
    customerName?: string,
    optin: boolean = true
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('restaurant_marketing_optins')
        .upsert({
          restaurant_id: restaurantId,
          customer_email: customerEmail,
          customer_name: customerName || null,
          marketing_optin: optin,
          marketing_optin_at: optin ? new Date().toISOString() : null,
        }, {
          onConflict: 'restaurant_id,customer_email'
        });

      if (error) {
        console.error('Erro ao salvar opt-in de marketing:', error);
        return false;
      }

      // Atualizar também no CRM consolidado
      await supabase
        .from('restaurant_customers')
        .update({
          marketing_optin: optin,
          marketing_optin_at: optin ? new Date().toISOString() : null,
        })
        .eq('restaurant_id', restaurantId)
        .eq('customer_email', customerEmail);

      setState(prev => ({
        ...prev,
        marketing: {
          marketing_optin: optin,
          marketing_optin_at: optin ? new Date().toISOString() : null,
        },
      }));

      return true;
    } catch (err) {
      console.error('Erro ao salvar opt-in de marketing:', err);
      return false;
    }
  }, []);

  return {
    ...state,
    termsAccepted: state.terms?.terms_accepted || false,
    marketingOptin: state.marketing?.marketing_optin || false,
    fetchConsents,
    saveTermsConsent,
    saveMarketingOptin,
  };
}

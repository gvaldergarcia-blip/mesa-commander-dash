import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { RestaurantCustomer } from './useRestaurantCustomers';

export type InsightType = 
  | 'queue_dropout'      // Cliente desistiu da fila
  | 'reservation_canceled' // Cliente cancelou reserva
  | 'inactive'           // Cliente inativo há X dias
  | 'recurrent'          // Cliente recorrente (3+ visitas no mês)
  | 'vip_missing'        // Cliente VIP sem visita recente
  | 'new_customer';      // Cliente novo (primeira visita)

export interface CustomerInsight {
  id: string;
  customer_id: string;
  restaurant_id: string;
  insight_type: InsightType;
  message: string;
  action_allowed: boolean; // true se cliente autorizou marketing
  dismissed: boolean;
  created_at: string;
}

// Configurações para geração de insights
const INACTIVE_DAYS_THRESHOLD = 30;
const VIP_MISSING_DAYS_THRESHOLD = 14;
const RECURRENT_VISITS_THRESHOLD = 3;

/**
 * Gera insights baseados no comportamento do cliente
 * REGRA: Todos os clientes são analisados, mas ação só é permitida se marketing_optin = true
 */
export function generateInsightsForCustomer(customer: RestaurantCustomer): Omit<CustomerInsight, 'id' | 'created_at'>[] {
  const insights: Omit<CustomerInsight, 'id' | 'created_at'>[] = [];
  const now = new Date();
  const lastSeen = new Date(customer.last_seen_at);
  const daysSinceLastVisit = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));
  const createdAt = new Date(customer.created_at);
  const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // Base para todos os insights
  const baseInsight = {
    customer_id: customer.id,
    restaurant_id: customer.restaurant_id,
    action_allowed: customer.marketing_optin, // LGPD: só permite ação se autorizou
    dismissed: false,
  };

  // 1. Cliente VIP sem visita recente
  if (customer.vip && daysSinceLastVisit > VIP_MISSING_DAYS_THRESHOLD) {
    insights.push({
      ...baseInsight,
      insight_type: 'vip_missing',
      message: `Cliente VIP não visita há ${daysSinceLastVisit} dias. Considere uma oferta especial de reengajamento.`,
    });
  }

  // 2. Cliente inativo (não VIP)
  else if (!customer.vip && daysSinceLastVisit > INACTIVE_DAYS_THRESHOLD) {
    insights.push({
      ...baseInsight,
      insight_type: 'inactive',
      message: `Cliente inativo há ${daysSinceLastVisit} dias. Uma promoção pode trazê-lo de volta.`,
    });
  }

  // 3. Cliente recorrente (3+ visitas total)
  if (customer.total_visits >= RECURRENT_VISITS_THRESHOLD && !customer.vip) {
    insights.push({
      ...baseInsight,
      insight_type: 'recurrent',
      message: `Cliente frequente com ${customer.total_visits} visitas. Candidate a programa de fidelidade.`,
    });
  }

  // 4. Cliente novo (criado nos últimos 7 dias)
  if (daysSinceCreated <= 7 && customer.total_visits <= 1) {
    insights.push({
      ...baseInsight,
      insight_type: 'new_customer',
      message: 'Cliente novo! Uma mensagem de boas-vindas pode fidelizá-lo.',
    });
  }

  return insights;
}

/**
 * Hook para gerenciar insights de clientes
 */
export function useCustomerInsights(restaurantId: string = RESTAURANT_ID) {
  const [insights, setInsights] = useState<CustomerInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Buscar insights salvos do banco
  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('system_insights')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('dismissed', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setInsights(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar insights';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Salvar insight no banco
  const saveInsight = useCallback(async (insight: Omit<CustomerInsight, 'id' | 'created_at'>) => {
    try {
      // Verificar se já existe um insight similar ativo para este cliente
      const { data: existing } = await supabase
        .from('system_insights')
        .select('id')
        .eq('customer_id', insight.customer_id)
        .eq('insight_type', insight.insight_type)
        .eq('dismissed', false)
        .single();

      if (existing) {
        // Já existe, não duplicar
        return null;
      }

      const { data, error: insertError } = await supabase
        .from('system_insights')
        .insert(insight)
        .select()
        .single();

      if (insertError) throw insertError;
      return data as CustomerInsight;
    } catch (err) {
      console.error('Erro ao salvar insight:', err);
      return null;
    }
  }, []);

  // Dispensar (dismiss) um insight
  const dismissInsight = useCallback(async (insightId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('system_insights')
        .update({ 
          dismissed: true, 
          dismissed_at: new Date().toISOString() 
        })
        .eq('id', insightId);

      if (updateError) throw updateError;

      // Atualizar estado local
      setInsights(prev => prev.filter(i => i.id !== insightId));
      
      toast({
        title: 'Insight dispensado',
        description: 'O insight foi removido da lista.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao dispensar insight';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Gerar insights para todos os clientes e salvar no banco
  const generateAndSaveInsights = useCallback(async (customers: RestaurantCustomer[]) => {
    setLoading(true);
    let newInsightsCount = 0;

    for (const customer of customers) {
      const customerInsights = generateInsightsForCustomer(customer);
      
      for (const insight of customerInsights) {
        const saved = await saveInsight(insight);
        if (saved) newInsightsCount++;
      }
    }

    if (newInsightsCount > 0) {
      toast({
        title: 'Insights gerados',
        description: `${newInsightsCount} novos insights foram identificados.`,
      });
    }

    await fetchInsights();
    setLoading(false);
  }, [saveInsight, fetchInsights, toast]);

  // Obter insight mais relevante para um cliente específico
  const getInsightForCustomer = useCallback((customerId: string): CustomerInsight | null => {
    return insights.find(i => i.customer_id === customerId) || null;
  }, [insights]);

  // Obter insights em tempo real (sem salvar no banco)
  const getRealtimeInsightsForCustomer = useCallback((customer: RestaurantCustomer): Omit<CustomerInsight, 'id' | 'created_at'>[] => {
    return generateInsightsForCustomer(customer);
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    loading,
    error,
    fetchInsights,
    saveInsight,
    dismissInsight,
    generateAndSaveInsights,
    getInsightForCustomer,
    getRealtimeInsightsForCustomer,
  };
}

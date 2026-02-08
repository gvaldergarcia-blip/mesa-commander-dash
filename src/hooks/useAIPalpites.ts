import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type PalpiteType = 
  | 'LONG_WAIT_RECOVERY' 
  | 'NO_SHOW_EDUCATE' 
  | 'COOLING_CUSTOMER' 
  | 'WINBACK' 
  | 'CHURN_RISK' 
  | 'VIP_ENGAGEMENT' 
  | 'NEW_CUSTOMER_FOLLOWUP' 
  | 'POST_VISIT' 
  | 'FREQUENT_CUSTOMER' 
  | 'ALMOST_VIP';

export interface AIPalpite {
  id: string;
  restaurant_id: string;
  customer_id: string | null;
  type: PalpiteType | string;
  title: string;
  message: string;
  priority: 'low' | 'med' | 'high';
  action_allowed: boolean;
  cta_type: string | null;
  cta_payload: {
    subject?: string;
    message?: string;
    coupon_code?: string;
    discount_percent?: number;
    valid_days?: number;
  } | null;
  status: 'new' | 'seen' | 'dismissed' | 'sent';
  created_at: string;
  updated_at: string;
  // Joined fields
  customer_name?: string;
  customer_email?: string;
}

export interface PalpitesStats {
  total: number;
  new_count: number;
  high_priority: number;
  sent_count: number;
}

export type PalpiteStatusFilter = 'all' | 'new' | 'seen' | 'dismissed' | 'sent';
export type PalpitePriorityFilter = 'all' | 'low' | 'med' | 'high';
export type PalpiteTypeFilter = 'all' | PalpiteType;

export function useAIPalpites(restaurantId: string) {
  const [palpites, setPalpites] = useState<AIPalpite[]>([]);
  const [stats, setStats] = useState<PalpitesStats>({
    total: 0,
    new_count: 0,
    high_priority: 0,
    sent_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPalpites = useCallback(async () => {
    if (!restaurantId) return;
    
    try {
      setLoading(true);
      setError(null);

      // Fetch palpites
      const { data: palpitesData, error: fetchError } = await supabase
        .from('ai_palpites')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch customer info for all customer_ids
      const customerIds = [...new Set((palpitesData || []).map(p => p.customer_id).filter(Boolean))];
      
      let customersMap: Record<string, { customer_name: string; customer_email: string }> = {};
      
      if (customerIds.length > 0) {
        const { data: customersData } = await supabase
          .from('restaurant_customers')
          .select('id, customer_name, customer_email')
          .in('id', customerIds);
        
        if (customersData) {
          customersMap = customersData.reduce((acc, c) => {
            acc[c.id] = { customer_name: c.customer_name || '', customer_email: c.customer_email };
            return acc;
          }, {} as Record<string, { customer_name: string; customer_email: string }>);
        }
      }

      // Map the data to include customer info at top level
      const mappedPalpites: AIPalpite[] = (palpitesData || []).map((p: any) => ({
        ...p,
        customer_name: p.customer_id ? customersMap[p.customer_id]?.customer_name : undefined,
        customer_email: p.customer_id ? customersMap[p.customer_id]?.customer_email : undefined,
        cta_payload: p.cta_payload as AIPalpite['cta_payload'],
      }));

      setPalpites(mappedPalpites);

      // Calculate stats
      const newStats: PalpitesStats = {
        total: mappedPalpites.length,
        new_count: mappedPalpites.filter(p => p.status === 'new').length,
        high_priority: mappedPalpites.filter(p => p.priority === 'high' && p.status !== 'dismissed' && p.status !== 'sent').length,
        sent_count: mappedPalpites.filter(p => p.status === 'sent').length,
      };
      setStats(newStats);

    } catch (err) {
      console.error('Error fetching palpites:', err);
      setError('Erro ao carregar palpites');
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os palpites.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId, toast]);

  const generatePalpites = useCallback(async () => {
    if (!restaurantId) return 0;
    
    try {
      const { data, error: rpcError } = await supabase
        .rpc('generate_ai_palpites', { p_restaurant_id: restaurantId });

      if (rpcError) throw rpcError;

      toast({
        title: 'Palpites gerados',
        description: `${data || 0} novos palpites foram criados.`,
      });

      await fetchPalpites();
      return data as number;
    } catch (err) {
      console.error('Error generating palpites:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar palpites.',
        variant: 'destructive',
      });
      return 0;
    }
  }, [restaurantId, fetchPalpites, toast]);

  const updatePalpiteStatus = useCallback(async (
    palpiteId: string, 
    newStatus: 'seen' | 'dismissed' | 'sent'
  ) => {
    try {
      const { error: updateError } = await supabase
        .from('ai_palpites')
        .update({ status: newStatus })
        .eq('id', palpiteId);

      if (updateError) throw updateError;

      // Update local state
      setPalpites(prev => prev.map(p => 
        p.id === palpiteId ? { ...p, status: newStatus } : p
      ));

      // Recalculate stats
      setStats(prev => {
        const palpite = palpites.find(p => p.id === palpiteId);
        if (!palpite) return prev;

        const wasNew = palpite.status === 'new';
        const wasHighPriority = palpite.priority === 'high' && palpite.status !== 'dismissed' && palpite.status !== 'sent';

        return {
          ...prev,
          new_count: wasNew ? prev.new_count - 1 : prev.new_count,
          high_priority: wasHighPriority && (newStatus === 'dismissed' || newStatus === 'sent') 
            ? prev.high_priority - 1 
            : prev.high_priority,
          sent_count: newStatus === 'sent' ? prev.sent_count + 1 : prev.sent_count,
        };
      });

      const statusMessages = {
        seen: 'Palpite marcado como visto',
        dismissed: 'Palpite dispensado',
        sent: 'Promoção enviada com sucesso',
      };

      toast({
        title: 'Sucesso',
        description: statusMessages[newStatus],
      });

      return true;
    } catch (err) {
      console.error('Error updating palpite status:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o palpite.',
        variant: 'destructive',
      });
      return false;
    }
  }, [palpites, toast]);

  const filterPalpites = useCallback((
    statusFilter: PalpiteStatusFilter = 'all',
    priorityFilter: PalpitePriorityFilter = 'all',
    typeFilter: PalpiteTypeFilter = 'all'
  ): AIPalpite[] => {
    return palpites.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      return true;
    });
  }, [palpites]);

  // REMOVIDO: Não gerar palpites automaticamente
  // Só carrega palpites existentes ao montar, mas NÃO gera novos automaticamente
  useEffect(() => {
    fetchPalpites();
  }, [fetchPalpites]);

  // NOTA: A geração de palpites só acontece quando o usuário clica em "Gerar Palpites"
  // através da função generatePalpites()

  return {
    palpites,
    stats,
    loading,
    error,
    fetchPalpites,
    generatePalpites,
    updatePalpiteStatus,
    filterPalpites,
  };
}

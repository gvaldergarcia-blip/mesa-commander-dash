import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

export type CustomerStatus = 'active' | 'inactive';

export type RestaurantCustomer = {
  id: string;
  restaurant_id: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  total_queue_visits: number;
  total_reservation_visits: number;
  total_visits: number;
  vip: boolean;
  status: CustomerStatus;
  marketing_optin: boolean;
  marketing_optin_at: string | null;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  tags: string[];
  internal_notes: string | null;
};

export type CustomerFilter = 'all' | 'active' | 'inactive' | 'vip' | 'new';
export type SourceFilter = 'all' | 'queue' | 'reservation';
export type MarketingFilter = 'all' | 'opt-in' | 'opt-out';
export type PeriodFilter = 'all' | '7days' | '30days' | '90days';

export type CustomerKPIs = {
  total: number;
  active: number;
  inactive: number;
  vip: number;
  newCustomers: number;
  marketingOptIn: number;
};

export function useRestaurantCustomers(restaurantId: string = RESTAURANT_ID) {
  const [customers, setCustomers] = useState<RestaurantCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('restaurant_customers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('last_seen_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setCustomers(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar clientes';
      setError(message);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Calcular KPIs
  const getKPIs = useCallback((): CustomerKPIs => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      total: customers.length,
      active: customers.filter(c => {
        const lastSeen = new Date(c.last_seen_at);
        return lastSeen >= thirtyDaysAgo;
      }).length,
      inactive: customers.filter(c => {
        const lastSeen = new Date(c.last_seen_at);
        return lastSeen < thirtyDaysAgo;
      }).length,
      vip: customers.filter(c => c.vip).length,
      newCustomers: customers.filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= sevenDaysAgo;
      }).length,
      marketingOptIn: customers.filter(c => c.marketing_optin).length,
    };
  }, [customers]);

  // Filtrar clientes
  const filterCustomers = useCallback((
    statusFilter: CustomerFilter = 'all',
    sourceFilter: SourceFilter = 'all',
    marketingFilter: MarketingFilter = 'all',
    periodFilter: PeriodFilter = 'all',
    searchTerm: string = ''
  ): RestaurantCustomer[] => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return customers.filter(customer => {
      // Busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = customer.customer_name?.toLowerCase().includes(term);
        const matchesEmail = customer.customer_email.toLowerCase().includes(term);
        const matchesPhone = customer.customer_phone?.includes(term);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      // Status
      if (statusFilter !== 'all') {
        const lastSeen = new Date(customer.last_seen_at);
        const createdAt = new Date(customer.created_at);
        
        if (statusFilter === 'vip' && !customer.vip) return false;
        if (statusFilter === 'new' && createdAt < sevenDaysAgo) return false;
        if (statusFilter === 'active' && lastSeen < thirtyDaysAgo) return false;
        if (statusFilter === 'inactive' && lastSeen >= thirtyDaysAgo) return false;
      }

      // Origem
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'queue' && customer.total_queue_visits === 0) return false;
        if (sourceFilter === 'reservation' && customer.total_reservation_visits === 0) return false;
      }

      // Marketing
      if (marketingFilter !== 'all') {
        if (marketingFilter === 'opt-in' && !customer.marketing_optin) return false;
        if (marketingFilter === 'opt-out' && customer.marketing_optin) return false;
      }

      // Período
      if (periodFilter !== 'all') {
        const lastSeen = new Date(customer.last_seen_at);
        if (periodFilter === '7days' && lastSeen < sevenDaysAgo) return false;
        if (periodFilter === '30days' && lastSeen < thirtyDaysAgo) return false;
        if (periodFilter === '90days' && lastSeen < ninetyDaysAgo) return false;
      }

      return true;
    });
  }, [customers]);

  // Obter clientes elegíveis para marketing
  const getMarketingEligible = useCallback((): RestaurantCustomer[] => {
    return customers.filter(c => c.marketing_optin && c.customer_email);
  }, [customers]);

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomers,
    getKPIs,
    filterCustomers,
    getMarketingEligible,
  };
}

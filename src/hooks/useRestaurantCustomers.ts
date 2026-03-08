import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant } from '@/contexts/RestaurantContext';

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
  loyalty_program_active: boolean;
  birthday: string | null;
  // Computed fields
  origin: 'queue' | 'reservation' | 'both' | 'manual';
  is_recurrent: boolean;
  is_birthday_month: boolean;
  is_birthday_soon: boolean;
  days_since_last_visit: number;
};

export type CustomerFilter = 'all' | 'active' | 'inactive' | 'vip' | 'new' | 'recurrent' | 'birthday';
export type SourceFilter = 'all' | 'queue' | 'reservation' | 'both';
export type MarketingFilter = 'all' | 'opt-in' | 'opt-out';
export type PeriodFilter = 'all' | '7days' | '30days' | '90days';

export type CustomerKPIs = {
  total: number;
  active: number;
  inactive: number;
  vip: number;
  newCustomers: number;
  marketingOptIn: number;
  recurrent: number;
  birthdayThisMonth: number;
};

function computeOrigin(c: { total_queue_visits: number; total_reservation_visits: number }): 'queue' | 'reservation' | 'both' | 'manual' {
  const hasQueue = c.total_queue_visits > 0;
  const hasReservation = c.total_reservation_visits > 0;
  if (hasQueue && hasReservation) return 'both';
  if (hasQueue) return 'queue';
  if (hasReservation) return 'reservation';
  return 'manual';
}

function computeTags(c: {
  vip: boolean;
  total_visits: number;
  total_queue_visits: number;
  total_reservation_visits: number;
  marketing_optin: boolean;
  birthday: string | null;
  last_seen_at: string;
  created_at: string;
}): string[] {
  const tags: string[] = [];
  const now = new Date();
  const lastSeen = new Date(c.last_seen_at);
  const createdAt = new Date(c.created_at);
  const daysSinceLastVisit = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  if (c.vip || c.total_visits >= 10) tags.push('VIP');
  if (daysSinceCreated <= 7 && c.total_visits <= 1) tags.push('Novo cliente');
  if (c.total_visits >= 3 && c.total_visits < 10) tags.push('Cliente recorrente');
  if (c.total_visits >= 10) tags.push('Cliente frequente');
  
  const origin = computeOrigin(c);
  if (origin === 'queue') tags.push('Veio pela fila');
  else if (origin === 'reservation') tags.push('Veio pela reserva');
  else if (origin === 'both') tags.push('Usa fila e reserva');
  
  if (c.marketing_optin) tags.push('Aceita promoções');
  if (daysSinceLastVisit > 30) tags.push('Inativo');

  // Birthday
  if (c.birthday) {
    const bday = new Date(c.birthday + 'T00:00:00');
    const currentMonth = now.getMonth();
    const bdayMonth = bday.getMonth();
    if (currentMonth === bdayMonth) tags.push('Aniversariante do mês');
    
    // Birthday within next 7 days
    const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    if (thisYearBday < now) thisYearBday.setFullYear(now.getFullYear() + 1);
    const daysUntilBday = Math.floor((thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilBday <= 7 && daysUntilBday >= 0) tags.push('Aniversário próximo');
  }

  // Alto potencial: 3+ visitas, aceita promoções, não é VIP ainda
  if (c.total_visits >= 3 && c.marketing_optin && !c.vip && c.total_visits < 10) {
    tags.push('Alto potencial');
  }

  return tags;
}

export function useRestaurantCustomers(overrideRestaurantId?: string) {
  const { restaurantId: contextRestaurantId } = useRestaurant();
  const restaurantId = overrideRestaurantId || contextRestaurantId;
  const [customers, setCustomers] = useState<RestaurantCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCustomers = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('restaurant_customers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('last_seen_at', { ascending: false });

      if (fetchError) throw fetchError;

      const now = new Date();
      
      const enriched = (data || []).map((c: any) => {
        const lastSeen = new Date(c.last_seen_at);
        const daysSinceLastVisit = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));
        const origin = computeOrigin(c);
        const tags = computeTags(c);
        
        // Birthday calculations
        let isBirthdayMonth = false;
        let isBirthdaySoon = false;
        if (c.birthday) {
          const bday = new Date(c.birthday + 'T00:00:00');
          isBirthdayMonth = now.getMonth() === bday.getMonth();
          const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
          if (thisYearBday < now) thisYearBday.setFullYear(now.getFullYear() + 1);
          const daysUntilBday = Math.floor((thisYearBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          isBirthdaySoon = daysUntilBday <= 7 && daysUntilBday >= 0;
        }
        
        return {
          ...c,
          loyalty_program_active: c.loyalty_program_active ?? false,
          origin,
          tags,
          is_recurrent: (c.total_visits || 0) >= 3,
          is_birthday_month: isBirthdayMonth,
          is_birthday_soon: isBirthdaySoon,
          days_since_last_visit: daysSinceLastVisit,
        };
      }) as RestaurantCustomer[];

      setCustomers(enriched);
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

  // Auto-refresh on window focus
  useEffect(() => {
    const handleWindowFocus = () => fetchCustomers();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchCustomers();
    };
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchCustomers]);

  const getKPIs = useCallback((): CustomerKPIs => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      total: customers.length,
      active: customers.filter(c => new Date(c.last_seen_at) >= thirtyDaysAgo).length,
      inactive: customers.filter(c => new Date(c.last_seen_at) < thirtyDaysAgo).length,
      vip: customers.filter(c => c.vip).length,
      newCustomers: customers.filter(c => new Date(c.created_at) >= sevenDaysAgo).length,
      marketingOptIn: customers.filter(c => c.marketing_optin).length,
      recurrent: customers.filter(c => c.is_recurrent && !c.vip).length,
      birthdayThisMonth: customers.filter(c => c.is_birthday_month).length,
    };
  }, [customers]);

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
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = customer.customer_name?.toLowerCase().includes(term);
        const matchesEmail = customer.customer_email.toLowerCase().includes(term);
        const matchesPhone = customer.customer_phone?.includes(term);
        const matchesTags = customer.tags.some(t => t.toLowerCase().includes(term));
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesTags) return false;
      }

      // Status
      if (statusFilter !== 'all') {
        const lastSeen = new Date(customer.last_seen_at);
        const createdAt = new Date(customer.created_at);
        
        if (statusFilter === 'vip' && !customer.vip && customer.total_visits < 10) return false;
        if (statusFilter === 'new' && createdAt < sevenDaysAgo) return false;
        if (statusFilter === 'active' && lastSeen < thirtyDaysAgo) return false;
        if (statusFilter === 'inactive' && lastSeen >= thirtyDaysAgo) return false;
        if (statusFilter === 'recurrent' && !customer.is_recurrent) return false;
        if (statusFilter === 'birthday' && !customer.is_birthday_month) return false;
      }

      // Origin
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'queue' && customer.total_queue_visits === 0) return false;
        if (sourceFilter === 'reservation' && customer.total_reservation_visits === 0) return false;
        if (sourceFilter === 'both' && (customer.total_queue_visits === 0 || customer.total_reservation_visits === 0)) return false;
      }

      // Marketing
      if (marketingFilter !== 'all') {
        if (marketingFilter === 'opt-in' && !customer.marketing_optin) return false;
        if (marketingFilter === 'opt-out' && customer.marketing_optin) return false;
      }

      // Period
      if (periodFilter !== 'all') {
        const lastSeen = new Date(customer.last_seen_at);
        if (periodFilter === '7days' && lastSeen < sevenDaysAgo) return false;
        if (periodFilter === '30days' && lastSeen < thirtyDaysAgo) return false;
        if (periodFilter === '90days' && lastSeen < ninetyDaysAgo) return false;
      }

      return true;
    });
  }, [customers]);

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

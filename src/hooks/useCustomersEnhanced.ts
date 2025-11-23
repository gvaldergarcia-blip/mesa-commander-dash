import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

export type CustomerStatus = 'vip' | 'new' | 'inactive' | 'active';

export type CustomerEnhanced = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  total_visits: number;
  queue_completed: number;
  reservations_completed: number;
  visits_completed: number;
  last_visit_at?: string;
  first_visit_at?: string;
  created_at: string;
  vip_status: boolean;
  marketing_opt_in: boolean;
  status: CustomerStatus;
  days_since_last_visit?: number;
  notes?: string;
};

export type CustomerFilter = 'all' | 'vip' | 'new' | 'inactive' | 'active';
export type SourceFilter = 'all' | 'queue' | 'reservation';

export function useCustomersEnhanced(searchTerm: string = '') {
  const [customers, setCustomers] = useState<CustomerEnhanced[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomersEnhanced();
  }, [searchTerm]);

  const fetchCustomersEnhanced = async () => {
    try {
      setLoading(true);

      // Buscar clientes da tabela customers (não da view)
      let query = supabase
        .from('customers')
        .select('*')
        .order('last_visit_date', { ascending: false });

      // Aplicar filtro de busca se houver
      if (searchTerm && searchTerm.trim() !== '') {
        const search = `%${searchTerm.trim()}%`;
        query = query.or(`name.ilike.${search},phone.ilike.${search},email.ilike.${search}`);
      }

      const { data: customersData, error: customersError } = await query;

      if (customersError) throw customersError;

      if (!customersData || customersData.length === 0) {
        setCustomers([]);
        return;
      }

      // Para cada cliente, usar os dados já existentes
      const enhancedCustomers = customersData.map((customer) => {
        const queueCompleted = customer.queue_completed || 0;
        const reservationsCompleted = customer.reservations_completed || 0;
        const visitsCompleted = queueCompleted + reservationsCompleted;

        // REGRA OFICIAL: VIP quando visits_completed >= 10
        const isVip = visitsCompleted >= 10;

        // Calcular status
        let status: CustomerStatus = 'active';
        const lastVisit = customer.last_visit_date ? new Date(customer.last_visit_date) : null;
        const firstVisit = customer.first_visit_at ? new Date(customer.first_visit_at) : new Date(customer.created_at);
        const now = new Date();

        let daysSinceLastVisit: number | undefined;

        if (lastVisit) {
          daysSinceLastVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
          
          // Priorizar VIP
          if (isVip) {
            status = 'vip';
          } 
          // Inativo: sem visita há mais de 30 dias
          else if (daysSinceLastVisit > 30) {
            status = 'inactive';
          } 
          // Novo: primeira visita nos últimos 7 dias E somente 1 visita
          else if (visitsCompleted === 1 && Math.floor((now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
            status = 'new';
          }
        } else {
          // Nunca visitou mas foi criado há menos de 7 dias
          if (Math.floor((now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
            status = 'new';
          } else {
            status = 'inactive';
          }
        }

        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone || '',
          email: customer.email,
          total_visits: customer.total_visits || 0,
          queue_completed: queueCompleted,
          reservations_completed: reservationsCompleted,
          visits_completed: visitsCompleted,
          last_visit_at: customer.last_visit_date,
          first_visit_at: customer.first_visit_at || customer.created_at,
          created_at: customer.created_at,
          vip_status: isVip,
          marketing_opt_in: customer.marketing_opt_in || false,
          status,
          days_since_last_visit: daysSinceLastVisit,
          notes: customer.notes,
        };
      });

      setCustomers(enhancedCustomers);
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
  };

  const getKPIs = () => {
    const total = customers.length;
    
    // REGRA OFICIAL: VIP quando visits_completed >= 10
    const vip = customers.filter(c => c.visits_completed >= 10).length;
    
    // Novos: primeira visita nos últimos 7 dias E somente 1 visita
    const newCustomers = customers.filter(c => c.status === 'new').length;
    
    // Inativos: última visita há mais de 30 dias (e não são VIP)
    const inactive = customers.filter(c => c.status === 'inactive').length;
    
    // Ativos: visitaram nos últimos 30 dias (excluindo VIPs e novos)
    const active = customers.filter(c => {
      const daysSince = c.days_since_last_visit;
      return daysSince !== undefined && daysSince <= 30 && c.visits_completed < 10 && c.status !== 'new';
    }).length;

    return { total, active, vip, newCustomers, inactive };
  };

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomersEnhanced,
    getKPIs,
  };
}

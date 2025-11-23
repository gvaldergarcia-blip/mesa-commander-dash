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

export function useCustomersEnhanced() {
  const [customers, setCustomers] = useState<CustomerEnhanced[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomersEnhanced();
  }, []);

  const fetchCustomersEnhanced = async () => {
    try {
      setLoading(true);

      // Buscar todos os clientes da view
      const { data: customersData, error: customersError } = await supabase
        .schema('mesaclik')
        .from('v_customers')
        .select('*')
        .order('last_visit_at', { ascending: false });

      if (customersError) throw customersError;

      if (!customersData || customersData.length === 0) {
        setCustomers([]);
        return;
      }

      // Para cada cliente, buscar dados de fila e reservas concluídas
      const enhancedCustomers = await Promise.all(
        customersData.map(async (customer) => {
          // Contar entradas de fila concluídas (seated)
          const { count: queueCount } = await supabase
            .schema('mesaclik')
            .from('queue_entries')
            .select('*', { count: 'exact', head: true })
            .eq('phone', customer.phone)
            .eq('status', 'seated');

          // Contar reservas concluídas (completed)
          const { count: reservationCount } = await supabase
            .schema('mesaclik')
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('phone', customer.phone)
            .eq('status', 'completed');

          const queueCompleted = queueCount || 0;
          const reservationsCompleted = reservationCount || 0;
          const visitsCompleted = queueCompleted + reservationsCompleted;

          // Calcular VIP: visits_completed >= 10
          const isVip = visitsCompleted >= 10;

          // Calcular status
          let status: CustomerStatus = 'active';
          const lastVisit = customer.last_visit_at ? new Date(customer.last_visit_at) : null;
          const firstVisit = new Date(customer.created_at);
          const now = new Date();

          let daysSinceLastVisit: number | undefined;

          if (lastVisit) {
            daysSinceLastVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
            
            if (isVip) {
              status = 'vip';
            } else if (daysSinceLastVisit > 30) {
              status = 'inactive';
            } else if (Math.floor((now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
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
            id: customer.name + customer.phone, // ID único
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            total_visits: customer.total_visits,
            queue_completed: queueCompleted,
            reservations_completed: reservationsCompleted,
            visits_completed: visitsCompleted,
            last_visit_at: customer.last_visit_at,
            first_visit_at: customer.created_at,
            created_at: customer.created_at,
            vip_status: isVip,
            marketing_opt_in: customer.marketing_opt_in,
            status,
            days_since_last_visit: daysSinceLastVisit,
            notes: customer.notes,
          };
        })
      );

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
    const active = customers.filter(c => {
      const daysSince = c.days_since_last_visit;
      return daysSince !== undefined && daysSince <= 30;
    }).length;
    const vip = customers.filter(c => c.status === 'vip').length;
    const newCustomers = customers.filter(c => {
      const daysSinceCreation = Math.floor(
        (new Date().getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceCreation <= 7;
    }).length;
    const inactive = customers.filter(c => c.status === 'inactive').length;

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

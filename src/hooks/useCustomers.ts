import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Customer = {
  name: string;
  phone: string;
  email?: string;
  last_visit_at: string;
  total_visits: number;
  marketing_opt_in: boolean;
  vip_status: boolean;
};

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('v_customers')
        .select('*')
        .order('last_visit_at', { ascending: false });

      if (error) throw error;
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
  };

  // TODO: Implementar criação de cliente diretamente na tabela customers quando necessário
  const createCustomer = async (customer: { name: string; phone: string; email?: string }) => {
    // Por enquanto, clientes são criados automaticamente via fila/reservas
    toast({
      title: 'Info',
      description: 'Clientes são criados automaticamente via fila ou reservas',
    });
    return null;
  };

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomers,
    createCustomer,
  };
}

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  total_visits: number;
  total_spent: number;
  last_visit_date?: string;
  marketing_opt_in: boolean;
  vip_status: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
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
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

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

  const createCustomer = async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([customer])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Cliente criado com sucesso',
      });

      await fetchCustomers();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar cliente';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomers,
    createCustomer,
  };
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OptInCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  marketing_opt_in: boolean;
  marketing_opt_in_updated_at: string | null;
  last_visit_date: string | null;
  total_visits: number;
  vip_status: boolean;
}

export const useOptInCustomers = () => {
  const [customers, setCustomers] = useState<OptInCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchOptInCustomers = async (includeInactive = false) => {
    try {
      setLoading(true);
      let query = supabase
        .from('customers')
        .select('*')
        .order('total_visits', { ascending: false });

      if (!includeInactive) {
        query = query.eq('marketing_opt_in', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast({
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleOptIn = async (customerId: string, optIn: boolean, notes?: string) => {
    try {
      // Update customer opt-in status
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          marketing_opt_in: optIn,
          marketing_opt_in_updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (updateError) throw updateError;

      // Create audit log
      const { error: auditError } = await supabase
        .from('email_preferences_audit')
        .insert({
          customer_id: customerId,
          source: 'painel',
          action: optIn ? 'opt_in' : 'opt_out',
          notes: notes || 'Manual toggle for testing',
        });

      if (auditError) throw auditError;

      toast({
        title: "Opt-in atualizado",
        description: `Cliente ${optIn ? 'ativado' : 'desativado'} para receber ofertas`,
      });

      await fetchOptInCustomers();
    } catch (err) {
      const error = err as Error;
      toast({
        title: "Erro ao atualizar opt-in",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchOptInCustomers();
  }, []);

  return {
    customers,
    loading,
    error,
    refetch: fetchOptInCustomers,
    toggleOptIn,
  };
};

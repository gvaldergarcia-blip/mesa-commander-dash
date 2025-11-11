import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EligibleCustomer {
  customer_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  marketing_opt_in: boolean;
  vip_status: boolean;
  visits_count: number;
  last_visit_at: string | null;
  loyalty_points: number;
}

export const useEligibleCustomers = (restaurantId: string) => {
  const [customers, setCustomers] = useState<EligibleCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const { toast } = useToast();

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      // Query restaurant_customers com join em customers e loyalty_points
      const { data: rcData, error: rcError } = await supabase
        .schema('mesaclik')
        .from('restaurant_customers')
        .select(`
          visits_count,
          last_visit_at,
          customer_id,
          customers:customer_id (
            id,
            full_name,
            email,
            phone,
            marketing_opt_in,
            vip_status
          )
        `)
        .eq('restaurant_id', restaurantId);

      if (rcError) throw rcError;

      // Buscar loyalty points separadamente
      const { data: lpData, error: lpError } = await supabase
        .schema('mesaclik')
        .from('loyalty_points')
        .select('customer_id, points')
        .eq('restaurant_id', restaurantId);

      if (lpError) throw lpError;

      // Map de pontos por customer_id
      const pointsMap = new Map(
        (lpData || []).map(lp => [lp.customer_id, lp.points])
      );

      // Combinar dados
      const formatted: EligibleCustomer[] = (rcData || [])
        .filter((item: any) => {
          if (!item.customers) return false;
          if (!includeInactive && !item.customers.marketing_opt_in) return false;
          return true;
        })
        .map((item: any) => ({
          customer_id: item.customer_id,
          full_name: item.customers.full_name,
          email: item.customers.email,
          phone: item.customers.phone,
          marketing_opt_in: item.customers.marketing_opt_in,
          vip_status: item.customers.vip_status,
          visits_count: item.visits_count,
          last_visit_at: item.last_visit_at,
          loyalty_points: pointsMap.get(item.customer_id) || 0,
        }))
        .sort((a, b) => b.visits_count - a.visits_count);

      setCustomers(formatted);
    } catch (err) {
      const error = err as Error;
      console.error("Error fetching eligible customers:", error);
      toast({
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (restaurantId) {
      fetchCustomers();
    }
  }, [restaurantId, includeInactive]);

  return {
    customers,
    loading,
    includeInactive,
    setIncludeInactive,
    refetch: fetchCustomers,
  };
};

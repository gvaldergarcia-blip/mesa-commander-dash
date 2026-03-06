import { useState, useEffect, useCallback } from "react";
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

  const fetchCustomers = useCallback(async () => {
    if (!restaurantId) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from("restaurant_customers")
        .select(`
          id,
          customer_name,
          customer_email,
          customer_phone,
          marketing_optin,
          vip,
          total_visits,
          last_seen_at
        `)
        .eq("restaurant_id", restaurantId)
        .order("last_seen_at", { ascending: false });

      if (!includeInactive) {
        query = query.eq("marketing_optin", true);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted: EligibleCustomer[] = (data || []).map((item) => ({
        customer_id: item.id,
        full_name: item.customer_name || "Cliente",
        email: item.customer_email,
        phone: item.customer_phone,
        marketing_opt_in: item.marketing_optin || false,
        vip_status: item.vip || false,
        visits_count: item.total_visits || 0,
        last_visit_at: item.last_seen_at,
        loyalty_points: 0,
      }));

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
  }, [restaurantId, includeInactive, toast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return {
    customers,
    loading,
    includeInactive,
    setIncludeInactive,
    refetch: fetchCustomers,
  };
};

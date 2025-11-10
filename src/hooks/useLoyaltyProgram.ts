import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LoyaltyProgram {
  restaurant_id: string;
  enabled: boolean;
  reward_description: string | null;
  expires_at: string | null;
  rules: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPoint {
  restaurant_id: string;
  customer_id: string;
  points: number;
  last_earned_at: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

export const useLoyaltyProgram = (restaurantId: string) => {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [points, setPoints] = useState<LoyaltyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProgram = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('loyalty_programs')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw error;
      setProgram(data);
    } catch (err) {
      const error = err as Error;
      console.error("Error fetching loyalty program:", error);
      toast({
        title: "Erro ao carregar programa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPoints = async () => {
    try {
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('loyalty_points')
        .select(`
          *,
          customers:customer_id (
            name,
            email,
            phone
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('points', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        ...item,
        customer_name: item.customers?.name || 'N/A',
        customer_email: item.customers?.email || 'N/A',
        customer_phone: item.customers?.phone || 'N/A',
      }));

      setPoints(formatted);
    } catch (err) {
      const error = err as Error;
      console.error("Error fetching loyalty points:", error);
    }
  };

  const saveProgram = async (data: Partial<LoyaltyProgram>) => {
    try {
      const { error } = await supabase
        .schema('mesaclik')
        .from('loyalty_programs')
        .upsert({
          restaurant_id: restaurantId,
          ...data,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Programa salvo",
        description: "Configurações do programa 10 Cliks atualizadas",
      });

      await fetchProgram();
    } catch (err) {
      const error = err as Error;
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const resetPoints = async (customerId: string) => {
    try {
      const { error } = await supabase.rpc('reset_customer_loyalty_points', {
        p_restaurant_id: restaurantId,
        p_customer_id: customerId,
      });

      if (error) throw error;

      toast({
        title: "Pontos resetados",
        description: "Os pontos do cliente foram resetados para 0",
      });

      await fetchPoints();
    } catch (err) {
      const error = err as Error;
      toast({
        title: "Erro ao resetar pontos",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    if (restaurantId) {
      fetchProgram();
      fetchPoints();
    }
  }, [restaurantId]);

  return {
    program,
    points,
    loading,
    saveProgram,
    resetPoints,
    refetch: () => {
      fetchProgram();
      fetchPoints();
    },
  };
};

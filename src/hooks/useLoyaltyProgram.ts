import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LoyaltyProgram {
  id: string;
  restaurant_id: string;
  is_active: boolean;
  program_name: string;
  required_visits: number;
  count_queue: boolean;
  count_reservations: boolean;
  reward_description: string;
  reward_validity_days: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerLoyaltyStatus {
  id: string;
  restaurant_id: string;
  customer_id: string;
  current_visits: number;
  reward_unlocked: boolean;
  reward_unlocked_at: string | null;
  reward_expires_at: string | null;
  activation_email_sent: boolean;
  reward_email_sent: boolean;
  customer_name?: string;
  customer_email?: string;
}

export const useLoyaltyProgram = (restaurantId: string) => {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [statuses, setStatuses] = useState<CustomerLoyaltyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchProgram = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("restaurant_loyalty_program" as any)
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (error) throw error;
      setProgram(data as any);
    } catch (err: any) {
      console.error("Error fetching loyalty program:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatuses = async () => {
    if (!restaurantId) return;
    try {
      const { data, error } = await supabase
        .from("customer_loyalty_status" as any)
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("current_visits", { ascending: false });

      if (error) throw error;

      // Enrich with customer names
      const customerIds = (data || []).map((s: any) => s.customer_id);
      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from("restaurant_customers")
          .select("id, customer_name, customer_email")
          .in("id", customerIds);

        const customerMap = new Map((customers || []).map((c) => [c.id, c]));
        const enriched = (data || []).map((s: any) => ({
          ...s,
          customer_name: (customerMap.get(s.customer_id) as any)?.customer_name || 'N/A',
          customer_email: (customerMap.get(s.customer_id) as any)?.customer_email || 'N/A',
        }));
        setStatuses(enriched);
      } else {
        setStatuses([]);
      }
    } catch (err: any) {
      console.error("Error fetching loyalty statuses:", err);
    }
  };

  const saveProgram = async (data: Partial<LoyaltyProgram>) => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("restaurant_loyalty_program" as any)
        .upsert(payload as any, { onConflict: "restaurant_id" });

      if (error) throw error;

      // If program is active, enroll all customers via edge function
      if (data.is_active) {
        console.log("[useLoyaltyProgram] Invoking loyalty-enroll save_program for:", restaurantId);
        const { data: fnData, error: fnError } = await supabase.functions.invoke("loyalty-enroll", {
          body: { restaurant_id: restaurantId, action: "save_program" },
        });
        if (fnError) {
          console.error("[useLoyaltyProgram] loyalty-enroll error:", fnError);
        } else {
          console.log("[useLoyaltyProgram] loyalty-enroll response:", fnData);
        }
      }

      toast({ title: "✅ Programa salvo", description: "Configurações atualizadas com sucesso" });
      await fetchProgram();
      await fetchStatuses();
    } catch (err: any) {
      console.error("[useLoyaltyProgram] saveProgram error:", err);
      toast({ title: "Erro ao salvar", description: err?.message || "Erro desconhecido ao salvar programa", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetCustomer = async (customerId: string) => {
    if (!restaurantId) return;
    try {
      const { error } = await supabase
        .from("customer_loyalty_status" as any)
        .update({
          current_visits: 0,
          reward_unlocked: false,
          reward_unlocked_at: null,
          reward_expires_at: null,
          reward_email_sent: false,
        } as any)
        .eq("restaurant_id", restaurantId)
        .eq("customer_id", customerId);

      if (error) throw error;
      toast({ title: "✅ Pontos resetados" });
      await fetchStatuses();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Fetch loyalty status for a single customer (used in profile)
  const fetchCustomerLoyalty = async (customerId: string): Promise<{ program: LoyaltyProgram | null; status: CustomerLoyaltyStatus | null }> => {
    if (!restaurantId) return { program: null, status: null };
    try {
      // Try to find existing program
      let { data: prog } = await supabase
        .from("restaurant_loyalty_program" as any)
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      // Auto-create program if it doesn't exist
      if (!prog) {
        const { data: newProg, error: createErr } = await supabase
          .from("restaurant_loyalty_program" as any)
          .upsert({
            restaurant_id: restaurantId,
            is_active: true,
            program_name: "Clube MesaClik",
            required_visits: 10,
            count_queue: true,
            count_reservations: true,
            reward_description: "Recompensa especial",
            reward_validity_days: 30,
          } as any, { onConflict: "restaurant_id" })
          .select("*")
          .single();

        if (!createErr && newProg) {
          prog = newProg;
        } else {
          console.error("[useLoyaltyProgram] Error auto-creating program:", createErr);
          return { program: null, status: null };
        }
      } else if (!prog.is_active) {
        // Activate if it exists but is inactive
        await supabase
          .from("restaurant_loyalty_program" as any)
          .update({ is_active: true } as any)
          .eq("restaurant_id", restaurantId);
        prog.is_active = true;
      }

      const { data: stat } = await supabase
        .from("customer_loyalty_status" as any)
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("customer_id", customerId)
        .maybeSingle();

      return { program: prog as any, status: stat as any };
    } catch {
      return { program: null, status: null };
    }
  };

  useEffect(() => {
    if (restaurantId) {
      fetchProgram();
      fetchStatuses();
    }
  }, [restaurantId]);

  return {
    program,
    statuses,
    loading,
    saving,
    saveProgram,
    resetCustomer,
    fetchCustomerLoyalty,
    refetch: () => { fetchProgram(); fetchStatuses(); },
  };
};

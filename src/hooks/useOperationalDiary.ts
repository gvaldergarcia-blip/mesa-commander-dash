import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";

export type KitchenEventType =
  | "receipt"
  | "label_issued"
  | "label_discharged"
  | "manipulation"
  | "consumption"
  | "loss"
  | "transfer"
  | "stock_check"
  | "purchase_request";

export interface OperationalEvent {
  id: string;
  restaurant_id: string;
  event_type: KitchenEventType;
  occurred_at: string;
  quantity: number | null;
  unit: string | null;
  payload: Record<string, any>;
  source: string | null;
  product_id: string | null;
  product_name: string | null;
  product_category: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  employee_id: string | null;
  employee_name: string | null;
  receipt_id: string | null;
  label_id: string | null;
}

interface Options {
  limit?: number;
  types?: KitchenEventType[];
}

export function useOperationalDiary(opts: Options = {}) {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();
  const { limit = 200, types } = opts;

  const query = useQuery({
    queryKey: ["operational-diary", restaurantId, limit, types?.join(",") ?? "all"],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("v_operational_diary")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (types && types.length) q = q.in("event_type", types);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as OperationalEvent[];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Realtime: qualquer inserção em kitchen_events invalida
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`kitchen_events:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "kitchen_events",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["operational-diary", restaurantId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, qc]);

  return {
    events: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
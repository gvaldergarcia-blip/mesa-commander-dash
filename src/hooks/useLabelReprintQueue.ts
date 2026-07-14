import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export interface ReprintQueueItem {
  id: string;
  restaurant_id: string;
  label_product_id: string;
  source_label_id: string | null;
  suggested_at: string;
  suggested_reason: string;
  status: "pending" | "printed" | "dismissed";
  product?: {
    name: string;
    validity_days: number;
    conservation_method: string | null;
    category: string | null;
  } | null;
}

export function useLabelReprintQueue() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["label_reprint_queue", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_reprint_queue")
        .select("*, product:label_product_id ( name, validity_days, conservation_method, category )")
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .order("suggested_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ReprintQueueItem[];
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`reprint_queue:${restaurantId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "label_reprint_queue",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => qc.invalidateQueries({ queryKey: ["label_reprint_queue", restaurantId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, qc]);

  const resolve = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "printed" | "dismissed" }) => {
      const { error } = await (supabase as any)
        .from("label_reprint_queue")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["label_reprint_queue", restaurantId] }),
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    resolve: resolve.mutateAsync,
  };
}
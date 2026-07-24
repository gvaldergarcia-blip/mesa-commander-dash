import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";

export interface DischargeEvent {
  id: string;
  label_id: string;
  discharged_at: string;
  reason: string;
  units: number;
  notes: string | null;
  employee_id: string | null;
  employee_name: string | null;
  product_name: string;
  unique_code: string;
  storage_location: string | null;
}

/** Eventos de baixa (label_discharges). Cada linha é uma baixa individual,
 *  incluindo baixas PARCIAIS (por unidade) — o que a query baseada em
 *  label_issuances.status='discharged' não captura. */
export function useLabelDischarges() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["label_discharges", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_discharges")
        .select(
          "id, label_id, discharged_at, reason, units, notes, employee_id, employee:employee_id(name), label:label_id(product_name, unique_code, storage_location)"
        )
        .eq("restaurant_id", restaurantId)
        .order("discharged_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        label_id: r.label_id,
        discharged_at: r.discharged_at,
        reason: r.reason,
        units: Number(r.units ?? 1),
        notes: r.notes ?? null,
        employee_id: r.employee_id ?? null,
        employee_name: r.employee?.name ?? null,
        product_name: r.label?.product_name ?? "—",
        unique_code: r.label?.unique_code ?? "",
        storage_location: r.label?.storage_location ?? null,
      })) as DischargeEvent[];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`label_discharges:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "label_discharges",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["label_discharges", restaurantId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, qc]);

  return { events: query.data || [], isLoading: query.isLoading, refetch: query.refetch };
}

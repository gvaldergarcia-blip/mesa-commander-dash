import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export type LabelStatus = "active" | "expired" | "discharged";
export type ConservationMethod = "refrigerated" | "frozen" | "ambient" | "hot";
export type DischargeReason = "use" | "loss" | "error";

export interface Label {
  id: string;
  restaurant_id: string;
  unique_code: string;
  label_product_id: string | null;
  product_name: string;
  manufacture_date: string;
  expiry_date: string;
  quantity: number;
  batch: string | null;
  responsible: string | null;
  employee_id: string | null;
  employee_name?: string | null;
  product_category?: string | null;
  conservation_method: ConservationMethod | null;
  notes: string | null;
  cif: string | null;
  allergens: string | null;
  ingredients: string | null;
  sif: string | null;
  storage_location: string | null;
  status: LabelStatus;
  discharge_reason: DischargeReason | null;
  resolved_at: string | null;
  created_at: string;
}

export interface LabelCreateInput {
  label_product_id?: string | null;
  product_name: string;
  manufacture_date: Date;
  expiry_date: Date;
  quantity: number;
  batch?: string | null;
  responsible?: string | null;
  employee_id?: string | null;
  conservation_method?: ConservationMethod | null;
  notes?: string | null;
  cif?: string | null;
  allergens?: string | null;
  ingredients?: string | null;
}

import { getLabelEffectiveStatus } from "@/lib/labels/utils";

export function useLabels() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["labels", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_issuances")
        .select("*, employee:employee_id ( name ), product:label_product_id ( category )")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        ...r,
        employee_name: r.employee?.name ?? null,
        product_category: r.product?.category ?? null,
      })) as Label[];
      // Recalc effective status
      return rows.map((l) => ({ ...l, status: getLabelEffectiveStatus(l) }));
    },
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  // Realtime: refetch when any label_issuance changes (e.g., discharge via QR on mobile)
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`label_issuances:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "label_issuances",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, qc]);

  const createLabel = useMutation({
    mutationFn: async (input: LabelCreateInput) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      const { data, error } = await (supabase as any)
        .from("label_issuances")
        .insert({
          restaurant_id: restaurantId,
          label_product_id: input.label_product_id ?? null,
          product_name: input.product_name,
          manufacture_date: input.manufacture_date.toISOString(),
          expiry_date: input.expiry_date.toISOString(),
          quantity: input.quantity,
          batch: input.batch ?? null,
          responsible: input.responsible ?? null,
          employee_id: input.employee_id ?? null,
          conservation_method: input.conservation_method ?? null,
          notes: input.notes ?? null,
          cif: input.cif ?? null,
          allergens: input.allergens ?? null,
          ingredients: input.ingredients ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Label;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labels", restaurantId] }),
    onError: (e: any) => toast.error(e.message || "Erro ao registrar etiqueta"),
  });

  const dischargeBulk = useMutation({
    mutationFn: async ({ ids, reason, notes }: { ids: string[]; reason: DischargeReason; notes?: string | null }) => {
      if (!restaurantId) return;
      // Insert discharge rows
      const rows = ids.map((id) => ({
        restaurant_id: restaurantId,
        label_id: id,
        reason,
        notes: notes ?? null,
      }));
      const { error: dErr } = await (supabase as any).from("label_discharges").insert(rows);
      if (dErr) throw dErr;
      const { error: uErr } = await (supabase as any)
        .from("label_issuances")
        .update({
          status: "discharged",
          discharge_reason: reason,
          resolved_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
      toast.success("Etiquetas baixadas");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao baixar etiquetas"),
  });

  return {
    labels: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    createLabel: createLabel.mutateAsync,
    dischargeBulk: dischargeBulk.mutateAsync,
  };
}
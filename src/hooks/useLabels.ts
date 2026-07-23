import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export type LabelStatus = "active" | "expired" | "discharged";
export type ConservationMethod = "refrigerated" | "frozen" | "ambient" | "hot";
export type DischargeReason =
  | "use"
  | "loss"
  | "error"
  | "vencimento"
  | "descarte"
  | "consumo"
  | "outro";

export interface Label {
  id: string;
  restaurant_id: string;
  unique_code: string;
  label_product_id: string | null;
  product_name: string;
  manufacture_date: string;
  expiry_date: string;
  quantity: number;
  units_used: number;
  units_remaining: number;
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
  weight: number | null;
  weight_unit: string | null;
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
        units_used: Number(r.units_used ?? 0),
        units_remaining: Math.max(0, Number(r.quantity ?? 1) - Number(r.units_used ?? 0)),
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
      // Busca códigos das etiquetas para usar a RPC (que trata unidades + estoque + alerta)
      const { data: rows, error: fErr } = await (supabase as any)
        .from("label_issuances")
        .select("id, unique_code, quantity, units_used, product_name, label_product_id, restaurant_id")
        .in("id", ids);
      if (fErr) throw fErr;
      for (const row of rows || []) {
        const remaining = Math.max(1, Number(row.quantity ?? 1) - Number(row.units_used ?? 0));
        const { data, error } = await (supabase as any).rpc("discharge_label_by_code", {
          _code: row.unique_code,
          _reason: reason,
          _employee_id: null,
          _notes: notes ?? null,
          _units: remaining,
        });
        if (error) throw error;
        // Dispara notificação SMS/WhatsApp (fire-and-forget)
        try {
          await (supabase as any).functions.invoke("send-label-discharge-alert", {
            body: {
              restaurant_id: row.restaurant_id,
              label_id: row.id,
              product_id: row.label_product_id,
              product_name: row.product_name,
              reason,
              units: data?.units_used ?? remaining,
              units_remaining: data?.units_remaining ?? 0,
              fully_discharged: data?.fully_discharged ?? true,
            },
          });
        } catch (_) { /* ignore */ }
      }
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
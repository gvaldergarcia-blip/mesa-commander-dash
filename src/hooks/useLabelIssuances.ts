import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export interface LabelIssuance {
  id: string;
  restaurant_id: string;
  label_product_id: string | null;
  product_name: string;
  manufacture_date: string;
  expiry_date: string;
  quantity: number;
  batch: string | null;
  responsible: string | null;
  notes: string | null;
  status: "active" | "consumed" | "discarded";
  resolved_at: string | null;
  created_at: string;
}

export interface LabelIssuanceInput {
  label_product_id?: string | null;
  product_name: string;
  manufacture_date: Date;
  expiry_date: Date;
  quantity: number;
  batch?: string | null;
  responsible?: string | null;
  notes?: string | null;
}

export function useLabelIssuances() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["label_issuances", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_issuances")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "active")
        .order("expiry_date", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data || []) as LabelIssuance[];
    },
    refetchInterval: 60_000,
  });

  const create = useMutation({
    mutationFn: async (input: LabelIssuanceInput) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      const { error } = await (supabase as any).from("label_issuances").insert({
        restaurant_id: restaurantId,
        label_product_id: input.label_product_id ?? null,
        product_name: input.product_name,
        manufacture_date: input.manufacture_date.toISOString(),
        expiry_date: input.expiry_date.toISOString(),
        quantity: input.quantity,
        batch: input.batch ?? null,
        responsible: input.responsible ?? null,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_issuances", restaurantId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar etiqueta"),
  });

  const resolve = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "consumed" | "discarded" }) => {
      const { error } = await (supabase as any)
        .from("label_issuances")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_issuances", restaurantId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar etiqueta"),
  });

  return {
    issuances: query.data || [],
    isLoading: query.isLoading,
    create: create.mutateAsync,
    resolve: resolve.mutateAsync,
  };
}
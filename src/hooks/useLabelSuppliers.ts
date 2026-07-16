import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export interface LabelSupplier {
  id: string;
  restaurant_id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useLabelSuppliers() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["label_suppliers", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_suppliers")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");
      if (error) throw error;
      return (data || []) as LabelSupplier[];
    },
  });

  const createSupplier = useMutation({
    mutationFn: async (input: { name: string; cnpj?: string; phone?: string; email?: string; notes?: string }) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      const { data, error } = await (supabase as any)
        .from("label_suppliers")
        .insert({
          restaurant_id: restaurantId,
          name: input.name.trim(),
          cnpj: input.cnpj?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as LabelSupplier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_suppliers", restaurantId] });
      toast.success("Fornecedor cadastrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao cadastrar fornecedor"),
  });

  return {
    suppliers: query.data || [],
    isLoading: query.isLoading,
    createSupplier: createSupplier.mutateAsync,
  };
}
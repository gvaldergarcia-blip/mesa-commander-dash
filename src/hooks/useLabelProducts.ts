import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export interface LabelProduct {
  id: string;
  restaurant_id: string;
  name: string;
  validity_days: number;
  notes: string | null;
  conservation_method?: "refrigerated" | "frozen" | "ambient" | "hot" | null;
  unit?: string | null;
  default_observation?: string | null;
  status?: "active" | "inactive";
  group_id?: string | null;
  category?: string | null;
  cif?: string | null;
  allergens?: string | null;
  ingredients?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabelProductInput {
  name: string;
  validity_days: number;
  notes?: string | null;
  conservation_method?: "refrigerated" | "frozen" | "ambient" | "hot" | null;
  unit?: string | null;
  default_observation?: string | null;
  status?: "active" | "inactive";
  group_id?: string | null;
  category?: string | null;
  cif?: string | null;
  allergens?: string | null;
  ingredients?: string | null;
}

export function useLabelProducts() {
  const restaurantId = useRestaurantId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["label_products", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as LabelProduct[];
      const { data, error } = await supabase
        .from("label_products")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as LabelProduct[];
    },
    enabled: !!restaurantId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: LabelProductInput) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      const { data, error } = await (supabase as any)
        .from("label_products")
        .insert({
          restaurant_id: restaurantId,
          name: input.name.trim(),
          validity_days: input.validity_days,
          notes: input.notes?.trim() || null,
          conservation_method: input.conservation_method ?? "refrigerated",
          unit: input.unit ?? "un",
          default_observation: input.default_observation?.trim() || null,
          status: input.status ?? "active",
          group_id: input.group_id ?? null,
          category: input.category?.trim() || null,
          cif: input.cif?.trim() || null,
          allergens: input.allergens?.trim() || null,
          ingredients: input.ingredients?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LabelProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label_products", restaurantId] });
      toast.success("Produto cadastrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao cadastrar produto"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: LabelProductInput }) => {
      const { data, error } = await (supabase as any)
        .from("label_products")
        .update({
          name: input.name.trim(),
          validity_days: input.validity_days,
          notes: input.notes?.trim() || null,
          conservation_method: input.conservation_method ?? undefined,
          unit: input.unit ?? undefined,
          default_observation: input.default_observation ?? undefined,
          status: input.status ?? undefined,
          group_id: input.group_id ?? undefined,
          category: input.category?.trim() || null,
          cif: input.cif?.trim() || null,
          allergens: input.allergens?.trim() || null,
          ingredients: input.ingredients?.trim() || null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as LabelProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label_products", restaurantId] });
      toast.success("Produto atualizado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar produto"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("label_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label_products", restaurantId] });
      toast.success("Produto removido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover produto"),
  });

  return {
    products: query.data || [],
    isLoading: query.isLoading,
    createProduct: createMutation.mutateAsync,
    updateProduct: updateMutation.mutateAsync,
    deleteProduct: deleteMutation.mutateAsync,
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
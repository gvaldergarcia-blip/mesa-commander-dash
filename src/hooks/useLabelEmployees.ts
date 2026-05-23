import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export interface LabelEmployee {
  id: string;
  restaurant_id: string;
  name: string;
  role: string | null;
  pin: string | null;
  status: "active" | "inactive";
  created_at: string;
}

export interface LabelEmployeeInput {
  name: string;
  role?: string | null;
  pin?: string | null;
  status?: "active" | "inactive";
}

export function useLabelEmployees() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["label_employees", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_employees")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");
      if (error) throw error;
      return (data || []) as LabelEmployee[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: LabelEmployeeInput) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      const { error } = await (supabase as any).from("label_employees").insert({
        restaurant_id: restaurantId,
        name: input.name.trim(),
        role: input.role?.trim() || null,
        pin: input.pin?.trim() || null,
        status: input.status ?? "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_employees", restaurantId] });
      toast.success("Funcionário cadastrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao cadastrar funcionário"),
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: LabelEmployeeInput }) => {
      const { error } = await (supabase as any)
        .from("label_employees")
        .update({
          name: input.name.trim(),
          role: input.role?.trim() || null,
          pin: input.pin?.trim() || null,
          status: input.status ?? "active",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_employees", restaurantId] });
      toast.success("Funcionário atualizado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("label_employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_employees", restaurantId] });
      toast.success("Funcionário removido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  return {
    employees: query.data || [],
    activeEmployees: (query.data || []).filter((e) => e.status === "active"),
    isLoading: query.isLoading,
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
    isMutating: create.isPending || update.isPending || remove.isPending,
  };
}
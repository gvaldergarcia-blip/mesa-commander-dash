import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export interface AutopilotSettings {
  restaurant_id: string;
  enabled: boolean;
  auto_publish: boolean;
  weekly_target: number;
  categories: string[];
  last_generated_at: string | null;
}

export interface WeeklySuggestion {
  id: string;
  restaurant_id: string;
  dish_id: string | null;
  dish_name: string | null;
  suggested_copy: string;
  suggested_hashtags: string | null;
  suggested_publish_at: string | null;
  image_url: string | null;
  status: "pending" | "approved" | "dismissed" | "published";
  week_of: string;
  created_at: string;
}

export function useStudioAutopilot() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ["autopilot_settings", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("studio_autopilot_settings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      return (data || null) as AutopilotSettings | null;
    },
  });

  const suggestions = useQuery({
    queryKey: ["weekly_suggestions", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("studio_weekly_suggestions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "approved"])
        .order("suggested_publish_at", { ascending: true })
        .limit(30);
      if (error) throw error;
      return (data || []) as WeeklySuggestion[];
    },
  });

  const upsertSettings = useMutation({
    mutationFn: async (patch: Partial<AutopilotSettings>) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      const { error } = await (supabase as any)
        .from("studio_autopilot_settings")
        .upsert({ restaurant_id: restaurantId, ...patch });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["autopilot_settings", restaurantId] }),
  });

  const generateNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-weekly-suggestions", {
        body: { restaurant_id: restaurantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weekly_suggestions", restaurantId] });
      qc.invalidateQueries({ queryKey: ["autopilot_settings", restaurantId] });
      toast.success("Sugestões geradas");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao gerar sugestões"),
  });

  const resolveSuggestion = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "dismissed" }) => {
      const { error } = await (supabase as any)
        .from("studio_weekly_suggestions")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly_suggestions", restaurantId] }),
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  return {
    settings: settings.data,
    suggestions: suggestions.data || [],
    isLoading: settings.isLoading || suggestions.isLoading,
    upsertSettings: upsertSettings.mutateAsync,
    generateNow: generateNow.mutateAsync,
    isGenerating: generateNow.isPending,
    resolveSuggestion: resolveSuggestion.mutateAsync,
  };
}
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";

export interface LabelSmsLog {
  id: string;
  restaurant_id: string;
  employee_id: string | null;
  phone: string;
  message: string;
  kind: "daily" | "expiry_alert" | "test" | "manual";
  status: "sent" | "failed" | "delivered";
  error: string | null;
  triggered_label_id: string | null;
  sent_at: string;
  employee?: { name: string } | null;
}

export function useLabelSmsLogs() {
  const restaurantId = useRestaurantId();

  const query = useQuery({
    queryKey: ["label_sms_logs", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_sms_logs")
        .select("*, employee:employee_id ( name )")
        .eq("restaurant_id", restaurantId)
        .order("sent_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as LabelSmsLog[];
    },
    refetchInterval: 30_000,
  });

  return { logs: query.data || [], isLoading: query.isLoading, refetch: query.refetch };
}
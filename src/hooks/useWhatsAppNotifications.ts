import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export type NotificationEventKey =
  | "validity_today"
  | "validity_tomorrow"
  | "validity_soon"
  | "stock_below_min"
  | "stock_out"
  | "stock_replenish"
  | "receipt_pending"
  | "receipt_awaiting_info"
  | "receipt_divergence"
  | "checklist_pending"
  | "loss_registered"
  | "transfer_done"
  | "operational_event";

export const NOTIFICATION_CATEGORIES: {
  category: string;
  items: { key: NotificationEventKey; label: string; description: string }[];
}[] = [
  {
    category: "Validade",
    items: [
      { key: "validity_today", label: "Produto vencendo hoje", description: "Aviso dos produtos que vencem no dia." },
      { key: "validity_tomorrow", label: "Produto vencendo amanhã", description: "Antecipa a reposição/manipulação." },
      { key: "validity_soon", label: "Próximo do vencimento", description: "Produtos que vencem em até 3 dias." },
    ],
  },
  {
    category: "Estoque",
    items: [
      { key: "stock_below_min", label: "Estoque abaixo do mínimo", description: "Produtos marcados em atenção." },
      { key: "stock_out", label: "Produto sem estoque", description: "Produtos marcados como falta." },
      { key: "stock_replenish", label: "Necessidade de reposição", description: "Lista de reposição do setor." },
    ],
  },
  {
    category: "Recebimento",
    items: [
      { key: "receipt_pending", label: "Recebimento pendente", description: "Rascunhos não confirmados." },
      { key: "receipt_awaiting_info", label: "Aguardando informação", description: "Produtos recebidos sem dados completos." },
      { key: "receipt_divergence", label: "Divergência no recebimento", description: "Quantidade/peso divergente da nota." },
    ],
  },
  {
    category: "Operação",
    items: [
      { key: "checklist_pending", label: "Checklist pendente", description: "Checklists não concluídos." },
      { key: "loss_registered", label: "Perda registrada", description: "Registro de perda na cozinha." },
      { key: "transfer_done", label: "Transferência realizada", description: "Movimentações entre setores." },
      { key: "operational_event", label: "Evento operacional importante", description: "Demais eventos relevantes." },
    ],
  },
];

export interface WhatsAppNotificationSettings {
  restaurant_id: string;
  enabled: boolean;
  connection_status: string;
  last_checked_at: string | null;
  last_error: string | null;
  events: Record<string, boolean>;
  quiet_hours_start: number;
  quiet_hours_end: number;
  dedupe_window_hours: number;
}

const DEFAULTS: Omit<WhatsAppNotificationSettings, "restaurant_id"> = {
  enabled: false,
  connection_status: "disconnected",
  last_checked_at: null,
  last_error: null,
  events: {},
  quiet_hours_start: 22,
  quiet_hours_end: 7,
  dedupe_window_hours: 12,
};

export function useWhatsAppNotifications() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();
  const key = ["whatsapp_notification_settings", restaurantId];

  const query = useQuery({
    queryKey: key,
    enabled: !!restaurantId,
    queryFn: async (): Promise<WhatsAppNotificationSettings> => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_notification_settings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (error) throw error;
      return { restaurant_id: restaurantId!, ...DEFAULTS, ...(data || {}) };
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<WhatsAppNotificationSettings>) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      const current = query.data ?? { restaurant_id: restaurantId, ...DEFAULTS };
      const { error } = await (supabase as any)
        .from("whatsapp_notification_settings")
        .upsert(
          {
            restaurant_id: restaurantId,
            enabled: patch.enabled ?? current.enabled,
            events: patch.events ?? current.events,
            quiet_hours_start: patch.quiet_hours_start ?? current.quiet_hours_start,
            quiet_hours_end: patch.quiet_hours_end ?? current.quiet_hours_end,
            dedupe_window_hours: patch.dedupe_window_hours ?? current.dedupe_window_hours,
          },
          { onConflict: "restaurant_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e.message || "Erro ao salvar configuração"),
  });

  const checkConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("notify-whatsapp", {
        body: { action: "status", restaurant_id: restaurantId },
      });
      if (error) throw error;
      return data as { connected: boolean; error: string | null };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: key });
      if (data?.connected) toast.success("WhatsApp conectado");
      else toast.error(data?.error || "WhatsApp desconectado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao verificar conexão"),
  });

  const sendTest = useMutation({
    mutationFn: async (to: string) => {
      const { data, error } = await supabase.functions.invoke("notify-whatsapp", {
        body: {
          action: "test",
          restaurant_id: restaurantId,
          event_type: "operational_event",
          to,
          message: "✅ MESACLIK\n\nTeste de notificação por WhatsApp. Se você recebeu esta mensagem, o canal está funcionando.",
        },
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      if (data?.sent > 0) toast.success("Mensagem de teste enviada!");
      else toast.error(data?.results?.[0]?.error || data?.skipped || "Falha ao enviar teste");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar teste"),
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("dispatch-whatsapp-events", {
        body: { restaurant_id: restaurantId },
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => toast.success(`Verificação concluída (${data?.dispatched ?? 0} evento(s))`),
    onError: (e: any) => toast.error(e.message || "Erro ao processar eventos"),
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    isSaving: save.isPending,
    checkConnection: checkConnection.mutateAsync,
    isChecking: checkConnection.isPending,
    sendTest: sendTest.mutateAsync,
    isSendingTest: sendTest.isPending,
    runNow: runNow.mutateAsync,
    isRunning: runNow.isPending,
  };
}

export interface WhatsAppLog {
  id: string;
  employee_id: string | null;
  phone: string;
  message: string;
  event_type: string | null;
  channel: string;
  status: string;
  error: string | null;
  provider_message_id: string | null;
  sent_at: string;
  employee?: { name: string } | null;
}

export function useWhatsAppLogs() {
  const restaurantId = useRestaurantId();
  const query = useQuery({
    queryKey: ["whatsapp_logs", restaurantId],
    enabled: !!restaurantId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_sms_logs")
        .select("*, employee:employee_id ( name )")
        .eq("restaurant_id", restaurantId)
        .eq("channel", "whatsapp")
        .order("sent_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as WhatsAppLog[];
    },
  });
  return { logs: query.data || [], isLoading: query.isLoading, refetch: query.refetch };
}
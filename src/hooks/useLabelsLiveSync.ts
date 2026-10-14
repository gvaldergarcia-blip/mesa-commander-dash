import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";

/** Todas as consultas que dependem de etiquetas/estoque — invalidadas juntas para nunca divergirem. */
const LABEL_KEYS = [
  "labels",
  "label_stock_balance",
  "label_movements",
  "label_discharges",
  "label_receipts",
  "product_stock_status",
  "operational-diary",
];

export function invalidateLabelData(qc: QueryClient, restaurantId: string | null | undefined) {
  if (!restaurantId) return;
  for (const key of LABEL_KEYS) qc.invalidateQueries({ queryKey: [key, restaurantId] });
}

/**
 * Canal único de tempo real do módulo Etiquetas. Montar uma vez por tela.
 * Impressão, recebimento, baixa por uso/vencimento (inclusive em outro celular)
 * atualizam Dashboard, Renovação e Estoque sem recarregar.
 */
export function useLabelsLiveSync() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  useEffect(() => {
    if (!restaurantId) return;
    let timer: number | null = null;
    const refresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => invalidateLabelData(qc, restaurantId), 250);
    };
    const filter = `restaurant_id=eq.${restaurantId}`;
    const channel = supabase.channel(`labels-live:${restaurantId}:${Math.random().toString(36).slice(2)}`);
    for (const table of ["label_issuances", "label_stock_movements", "label_discharges", "label_receipts"]) {
      channel.on("postgres_changes" as any, { event: "*", schema: "public", table, filter }, refresh);
    }
    channel.subscribe();
    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurantId, qc]);
}

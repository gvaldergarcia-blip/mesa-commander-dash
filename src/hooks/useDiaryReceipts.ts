import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";

export interface DiaryIssuance {
  id: string;
  restaurant_id: string;
  receipt_id: string | null;
  label_product_id: string | null;
  product_name: string;
  manufacture_date: string;
  expiry_date: string;
  quantity: number;
  printed_labels: number;
  batch: string | null;
  responsible: string | null;
  employee_id: string | null;
  conservation_method: string | null;
  notes: string | null;
  cif: string | null;
  sif: string | null;
  allergens: string | null;
  ingredients: string | null;
  storage_location: string | null;
  weight: number | null;
  weight_unit: string | null;
  unique_code: string;
  status: string;
  created_at: string;
}

export interface DiaryReceipt {
  id: string;
  received_at: string;
  reference: string | null;
  supplier: { id: string; name: string } | null;
  supplier_id: string | null;
  status: string;
}

export function useDiaryPending() {
  const restaurantId = useRestaurantId();
  return useQuery({
    queryKey: ["diary_pending", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: issuances, error } = await (supabase as any)
        .from("label_issuances")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "active")
        .not("receipt_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (issuances || []) as DiaryIssuance[];
      const pending = rows.filter(
        (r) => Math.max(0, (r.quantity || 0) - (r.printed_labels || 0)) > 0,
      );
      const receiptIds = Array.from(new Set(pending.map((r) => r.receipt_id!).filter(Boolean)));
      let receipts: DiaryReceipt[] = [];
      if (receiptIds.length) {
        const { data: rec } = await (supabase as any)
          .from("label_receipts")
          .select("id, received_at, reference, status, supplier_id, supplier:supplier_id ( id, name )")
          .in("id", receiptIds);
        receipts = (rec || []) as DiaryReceipt[];
      }
      const byReceipt = new Map<string, DiaryReceipt>();
      receipts.forEach((r) => byReceipt.set(r.id, r));
      return { issuances: pending, receipts: byReceipt };
    },
    refetchInterval: 30_000,
  });
}

export function useDiaryHistory(limit = 30) {
  const restaurantId = useRestaurantId();
  return useQuery({
    queryKey: ["diary_history", restaurantId, limit],
    enabled: !!restaurantId,
    queryFn: async () => {
      // Receipts confirmed
      const { data: recs, error } = await (supabase as any)
        .from("label_receipts")
        .select("id, received_at, reference, status, supplier:supplier_id ( id, name )")
        .eq("restaurant_id", restaurantId)
        .eq("status", "confirmed")
        .order("received_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const receipts = (recs || []) as any[];
      const ids = receipts.map((r) => r.id);
      let counts: Record<string, { total: number; printed: number; products: number }> = {};
      if (ids.length) {
        const { data: issAll } = await (supabase as any)
          .from("label_issuances")
          .select("receipt_id, quantity, printed_labels")
          .in("receipt_id", ids);
        (issAll || []).forEach((i: any) => {
          const k = i.receipt_id as string;
          if (!counts[k]) counts[k] = { total: 0, printed: 0, products: 0 };
          counts[k].total += Number(i.quantity || 0);
          counts[k].printed += Number(i.printed_labels || 0);
          counts[k].products += 1;
        });
      }
      return receipts.map((r) => ({ ...r, stats: counts[r.id] || { total: 0, printed: 0, products: 0 } }));
    },
  });
}

export function useRegisterPrints() {
  const qc = useQueryClient();
  const restaurantId = useRestaurantId();
  return useMutation({
    mutationFn: async (prints: { id: string; count: number }[]) => {
      if (!prints.length) return;
      const { error } = await (supabase as any).rpc("label_register_prints", { _prints: prints });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary_pending", restaurantId] });
      qc.invalidateQueries({ queryKey: ["diary_history", restaurantId] });
      qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
    },
  });
}

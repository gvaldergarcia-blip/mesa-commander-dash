import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  restaurant_id: string;
  raw_name: string;
  product_id: string | null;
  quantity: number;
  unit: string | null;
  needs_info: boolean;
  missing_fields: string[];
  labels_prepared: number;
  created_at: string;
}

export interface Receipt {
  id: string;
  restaurant_id: string;
  supplier_id: string | null;
  source: "manual" | "csv" | "xml" | "excel";
  status: "draft" | "pending_info" | "ready_to_print" | "confirmed" | "canceled";
  received_at: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  items?: ReceiptItem[];
  supplier?: { id: string; name: string } | null;
}

export function useReceipts() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["label_receipts", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_receipts")
        .select("*, supplier:supplier_id ( id, name ), items:label_receipt_items ( * )")
        .eq("restaurant_id", restaurantId)
        .order("received_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Receipt[];
    },
  });

  const createReceipt = useMutation({
    mutationFn: async (input: {
      supplier_id?: string | null;
      source?: "manual" | "csv" | "xml" | "excel";
      reference?: string;
      notes?: string;
      items: { raw_name: string; quantity: number; unit?: string }[];
    }) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");

      // 1) create receipt
      const { data: receipt, error: rErr } = await (supabase as any)
        .from("label_receipts")
        .insert({
          restaurant_id: restaurantId,
          supplier_id: input.supplier_id ?? null,
          source: input.source ?? "manual",
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          status: "draft",
        })
        .select("*")
        .single();
      if (rErr) throw rErr;

      // 2) match each line
      const itemsRows: any[] = [];
      for (const it of input.items) {
        const { data: matchedId } = await (supabase as any).rpc("label_match_alias", {
          _restaurant_id: restaurantId,
          _raw: it.raw_name,
        });

        let needs_info = false;
        let missing_fields: string[] = [];

        if (matchedId) {
          // check product completeness
          const { data: prod } = await (supabase as any)
            .from("label_products")
            .select("validity_days, conservation_method, unit, category, storage_location")
            .eq("id", matchedId)
            .maybeSingle();
          if (prod) {
            if (!prod.validity_days) missing_fields.push("validade pós-abertura");
            if (!prod.conservation_method) missing_fields.push("conservação");
            if (!prod.storage_location) missing_fields.push("local");
            if (!prod.category) missing_fields.push("setor");
            needs_info = missing_fields.length > 0;
          }
        } else {
          needs_info = true;
          missing_fields = ["produto novo"];
        }

        itemsRows.push({
          receipt_id: receipt.id,
          restaurant_id: restaurantId,
          raw_name: it.raw_name,
          product_id: matchedId ?? null,
          quantity: it.quantity,
          unit: it.unit ?? "un",
          needs_info,
          missing_fields,
        });
      }

      const { error: iErr } = await (supabase as any).from("label_receipt_items").insert(itemsRows);
      if (iErr) throw iErr;

      // 3) update status
      const anyPending = itemsRows.some((r) => r.needs_info);
      await (supabase as any)
        .from("label_receipts")
        .update({ status: anyPending ? "pending_info" : "ready_to_print" })
        .eq("id", receipt.id);

      return receipt.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] });
      qc.invalidateQueries({ queryKey: ["label_movements", restaurantId] });
      toast.success("Recebimento registrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar recebimento"),
  });

  const linkItemToProduct = useMutation({
    mutationFn: async ({
      itemId,
      productId,
      rawName,
      supplierId,
    }: { itemId: string; productId: string; rawName: string; supplierId?: string | null }) => {
      if (!restaurantId) return;
      // learn alias
      await (supabase as any).rpc("label_learn_alias", {
        _restaurant_id: restaurantId,
        _raw: rawName,
        _product_id: productId,
        _supplier_id: supplierId ?? null,
      });
      // check product completeness
      const { data: prod } = await (supabase as any)
        .from("label_products")
        .select("validity_days, conservation_method, category, storage_location")
        .eq("id", productId)
        .maybeSingle();
      const missing: string[] = [];
      if (prod) {
        if (!prod.validity_days) missing.push("validade pós-abertura");
        if (!prod.conservation_method) missing.push("conservação");
        if (!prod.storage_location) missing.push("local");
        if (!prod.category) missing.push("setor");
      }
      await (supabase as any)
        .from("label_receipt_items")
        .update({
          product_id: productId,
          needs_info: missing.length > 0,
          missing_fields: missing,
        })
        .eq("id", itemId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] }),
    onError: (e: any) => toast.error(e.message || "Erro ao vincular produto"),
  });

  const confirmReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      if (!restaurantId) return;
      const { data, error } = await (supabase as any).rpc("label_confirm_receipt", {
        _receipt_id: receiptId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] });
      qc.invalidateQueries({ queryKey: ["label_movements", restaurantId] });
      qc.invalidateQueries({ queryKey: ["label_products", restaurantId] });
      qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
      qc.invalidateQueries({ queryKey: ["operational-diary", restaurantId] });
      toast.success("Recebimento confirmado. Etiquetas prontas para impressão.");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao confirmar recebimento"),
  });

  const cancelReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      await (supabase as any)
        .from("label_receipts")
        .update({ status: "canceled" })
        .eq("id", receiptId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] }),
  });

  return {
    receipts: query.data || [],
    isLoading: query.isLoading,
    createReceipt: createReceipt.mutateAsync,
    isCreating: createReceipt.isPending,
    linkItemToProduct: linkItemToProduct.mutateAsync,
    confirmReceipt: confirmReceipt.mutateAsync,
    isConfirming: confirmReceipt.isPending,
    cancelReceipt: cancelReceipt.mutateAsync,
  };
}

export function useLabelMovements(limit = 100) {
  const restaurantId = useRestaurantId();
  return useQuery({
    queryKey: ["label_movements", restaurantId, limit],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("label_stock_movements")
        .select("*, product:product_id ( name ), supplier:supplier_id ( name )")
        .eq("restaurant_id", restaurantId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });
}
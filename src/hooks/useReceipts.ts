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
  weight: number | null;
  weight_unit: string | null;
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
      items: {
        raw_name: string;
        quantity: number;
        unit?: string;
        weight?: number | null;
        weight_unit?: string | null;
      }[];
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

      // 2) create receipt lines as pending.
      // A lista/NF do fornecedor serve somente para montar a fila de itens.
      // Nenhum produto é reconhecido ou processado aqui: o casamento inteligente
      // acontece depois, obrigatoriamente, pelas fotos das etiquetas do fabricante.
      // Pré-agregação por produto — SEMPRE em peças (quantidade física).
      // Peso é atributo, nunca vira quantidade. Ex.: 1 peça de 9,84 kg
      // continua sendo 1 registro (= 1 etiqueta) com o peso preservado.
      const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
      const WEIGHT_UNITS = new Set(["kg", "g", "l", "ml"]);
      type Agg = {
        raw_name: string;
        pieces: number;
        unit: string;
        weight: number | null;
        weight_unit: string | null;
      };
      const aggregated = new Map<string, Agg>();
      for (const it of input.items) {
        const rawUnit = (it.unit ?? "un").trim().toLowerCase();
        let pieces = Math.max(1, Math.floor(Number(it.quantity || 0)));
        let unit = "un";
        let weight: number | null = it.weight ?? null;
        let weightUnit: string | null = it.weight_unit ?? null;
        // Se o usuário escolheu unidade de peso/volume, o valor é PESO,
        // não quantidade de peças. Forçamos 1 peça e guardamos o peso.
        if (WEIGHT_UNITS.has(rawUnit)) {
          weight = Number(it.quantity || 0) || weight;
          weightUnit = rawUnit;
          pieces = 1;
          unit = "un";
        } else if (rawUnit) {
          unit = rawUnit;
        }
        const key = `${norm(it.raw_name)}|${unit}|${weightUnit ?? ""}`;
        const prev = aggregated.get(key);
        if (prev) {
          prev.pieces += pieces;
          if (weight != null) prev.weight = (prev.weight ?? 0) + weight;
        } else {
          aggregated.set(key, {
            raw_name: it.raw_name.trim(),
            pieces,
            unit,
            weight,
            weight_unit: weightUnit,
          });
        }
      }
      const itemsRows = Array.from(aggregated.values()).map((it) => ({
        receipt_id: receipt.id,
        restaurant_id: restaurantId,
        raw_name: it.raw_name,
        product_id: null,
        quantity: it.pieces,
        unit: it.unit,
        weight: it.weight,
        weight_unit: it.weight_unit,
        needs_info: true,
        missing_fields: ["foto da etiqueta do fornecedor"],
      }));

      const { data: insertedItems, error: iErr } = await (supabase as any)
        .from("label_receipt_items")
        .insert(itemsRows)
        .select("id, raw_name");
      if (iErr) throw iErr;

      await (supabase as any)
        .from("label_receipts")
        .update({ status: "pending_info" })
        .eq("id", receipt.id);

      return {
        receiptId: receipt.id as string,
        id: receipt.id as string,
        items: insertedItems ?? [],
        result: { pending: itemsRows.length },
      };
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] });
      qc.invalidateQueries({ queryKey: ["label_movements", restaurantId] });
      qc.invalidateQueries({ queryKey: ["operational-diary", restaurantId] });
      qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
      qc.invalidateQueries({ queryKey: ["product_stock_status", restaurantId] });
      toast.success("Recebimento registrado. Envie as fotos das etiquetas para completar.");
      const resolved = Number(res?.result?.restock_resolved || 0);
      if (resolved > 0) {
        toast.success(
          resolved === 1
            ? "1 pendência de reposição foi encerrada."
            : `${resolved} pendências de reposição foram encerradas.`,
        );
      }
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

      // Se o item ficou completo, já processa (gera etiqueta + diário)
      if (missing.length === 0) {
        const { data: item } = await (supabase as any)
          .from("label_receipt_items")
          .select("receipt_id")
          .eq("id", itemId)
          .maybeSingle();
        if (item?.receipt_id) {
          const { data: r } = await (supabase as any).rpc("label_process_ready_items", {
            _receipt_id: item.receipt_id,
          });
          return r;
        }
      }
      return null;
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] });
      qc.invalidateQueries({ queryKey: ["operational-diary", restaurantId] });
      qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
      qc.invalidateQueries({ queryKey: ["label_movements", restaurantId] });
      qc.invalidateQueries({ queryKey: ["product_stock_status", restaurantId] });
      const resolved = Number(r?.restock_resolved || 0);
      if (resolved > 0) {
        toast.success(
          resolved === 1
            ? "1 pendência de reposição foi encerrada."
            : `${resolved} pendências de reposição foram encerradas.`,
        );
      }
    },
    onError: (e: any) => toast.error(e.message || "Erro ao vincular produto"),
  });

  // Resolve várias pendências de uma vez (Painel de Pendências).
  // Cada resolução vira um product + link do item; ao final, dispara o
  // processamento do recebimento (uma única vez) para gerar etiquetas.
  const bulkResolvePending = useMutation({
    mutationFn: async (input: {
      receiptId: string;
      supplierId?: string | null;
      items: Array<{
        itemId: string;
        rawName: string;
        name: string;
        validity_days: number;
        conservation_method: "refrigerated" | "frozen" | "ambient" | "hot";
        category?: string | null;
        storage_location?: string | null;
        sif?: string | null;
        batch?: string | null;
        weight?: number | null;
        weight_unit?: string | null;
      }>;
    }) => {
      if (!restaurantId) throw new Error("Restaurante não identificado");
      for (const it of input.items) {
        // 1) cria produto mínimo
        const { data: prod, error: pErr } = await (supabase as any)
          .from("label_products")
          .insert({
            restaurant_id: restaurantId,
            name: (it.name || it.rawName).trim(),
            validity_days: Math.max(1, it.validity_days || 1),
            conservation_method: it.conservation_method || "refrigerated",
            category: it.category || null,
            storage_location: it.storage_location || null,
            sif: it.sif || null,
            unit: "un",
            status: "active",
          })
          .select("id")
          .single();
        if (pErr) throw pErr;

        // 2) aprende o alias e liga o item
        await (supabase as any).rpc("label_learn_alias", {
          _restaurant_id: restaurantId,
          _raw: it.rawName,
          _product_id: prod.id,
          _supplier_id: input.supplierId ?? null,
        });
        const upd: any = { product_id: prod.id, needs_info: false, missing_fields: [] };
        if (it.weight != null) upd.weight = it.weight;
        if (it.weight_unit) upd.weight_unit = it.weight_unit;
        await (supabase as any)
          .from("label_receipt_items")
          .update(upd)
          .eq("id", it.itemId);

        // 3) lote (se veio da foto) — armazenado no issuance após o processamento
        // será tratado depois de label_process_ready_items abaixo.
      }

      // 4) processa TODOS os itens prontos do recebimento (gera etiquetas + diário)
      const { data: r } = await (supabase as any).rpc("label_process_ready_items", {
        _receipt_id: input.receiptId,
      });

      // 5) grava lote nas issuances recém-criadas
      for (const it of input.items) {
        if (!it.batch) continue;
        try {
          const { data: prod } = await (supabase as any)
            .from("label_receipt_items")
            .select("product_id")
            .eq("id", it.itemId)
            .maybeSingle();
          if (!prod?.product_id) continue;
          const { data: last } = await (supabase as any)
            .from("label_issuances")
            .select("id")
            .eq("label_product_id", prod.product_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (last?.id) {
            await (supabase as any)
              .from("label_issuances")
              .update({ batch: it.batch })
              .eq("id", last.id);
          }
        } catch (e) { console.warn("Falha ao gravar lote", e); }
      }
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] });
      qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
      qc.invalidateQueries({ queryKey: ["operational-diary", restaurantId] });
      qc.invalidateQueries({ queryKey: ["label_movements", restaurantId] });
      qc.invalidateQueries({ queryKey: ["product_stock_status", restaurantId] });
      qc.invalidateQueries({ queryKey: ["label_products", restaurantId] });
      toast.success("Pendências resolvidas e etiquetas prontas.");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao resolver pendências"),
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

  // Finaliza um recebimento: fecha TODAS as pendências (impressão, foto,
  // completar cadastro) e move o card para o histórico. Após isso, nada
  // daquele fornecedor permanece na área operacional.
  const finalizeReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      const { data, error } = await (supabase as any).rpc("label_finalize_receipt", {
        _receipt_id: receiptId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] });
      qc.invalidateQueries({ queryKey: ["diary_pending", restaurantId] });
      qc.invalidateQueries({ queryKey: ["diary_history", restaurantId] });
      qc.invalidateQueries({ queryKey: ["operational-diary", restaurantId] });
      qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
      toast.success("Recebimento finalizado e enviado ao histórico.");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao finalizar recebimento"),
  });

  return {
    receipts: query.data || [],
    isLoading: query.isLoading,
    createReceipt: createReceipt.mutateAsync,
    isCreating: createReceipt.isPending,
    linkItemToProduct: linkItemToProduct.mutateAsync,
    bulkResolvePending: bulkResolvePending.mutateAsync,
    isBulkResolving: bulkResolvePending.isPending,
    confirmReceipt: confirmReceipt.mutateAsync,
    isConfirming: confirmReceipt.isPending,
    cancelReceipt: cancelReceipt.mutateAsync,
    finalizeReceipt: finalizeReceipt.mutateAsync,
    isFinalizing: finalizeReceipt.isPending,
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
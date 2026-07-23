import { useMemo } from "react";
import { useLabels, type Label } from "@/hooks/useLabels";
import { useLabelProducts, type LabelProduct } from "@/hooks/useLabelProducts";
import { useReceipts } from "@/hooks/useReceipts";
import { classifyExpiry } from "@/lib/labels/utils";

export interface ReceiptSummary {
  receipt_id: string;
  received_at: string;
  supplier_name: string | null;
  quantity: number;
  unit: string | null;
  labels_prepared: number;
  batch: string | null;
  expiry_date: string | null;
}

export interface LabeledProduct {
  product_id: string | null;      // null → não vinculado
  product_name: string;
  sector: string | null;          // storage_location
  category: string | null;        // categoria (compat)
  status: "ok" | "warning" | "critical" | "expired";
  labels_count: number;
  active_labels_count: number;
  active_non_expired_labels_count: number;
  active_units: number;                // Σ(quantity - units_used) das etiquetas ativas
  active_units_non_expired: number;    // idem, apenas as não-vencidas
  discharged_labels_count: number;
  active_label_ids: string[];
  last_discharge_at: string | null;
  last_discharge_reason: string | null;
  receipts_count: number;
  last_receipt_at: string | null;
  last_label_at: string | null;
  last_supplier: string | null;
  last_expiry: string | null;
  raw: LabelProduct | null;
  receipts: ReceiptSummary[];
}

function computeStatus(labels: Label[]): LabeledProduct["status"] {
  let worst: LabeledProduct["status"] = "ok";
  const rank = { ok: 0, warning: 1, critical: 2, expired: 3 } as const;
  for (const l of labels) {
    if (l.status === "discharged") continue;
    const c = classifyExpiry(l.expiry_date);
    let s: LabeledProduct["status"] = "ok";
    if (c === "expired") s = "expired";
    else if (c === "today") s = "critical";
    else if (c === "tomorrow") s = "warning";
    if (rank[s] > rank[worst]) worst = s;
  }
  return worst;
}

export function useLabeledProducts() {
  const { labels, isLoading: labelsLoading } = useLabels();
  const { products } = useLabelProducts();
  const { receipts, isLoading: recLoading } = useReceipts();

  const data = useMemo(() => {
    const productMap = new Map<string, LabelProduct>();
    for (const p of products) productMap.set(p.id, p);

    // Agrupa etiquetas por produto (id preferencial, nome como fallback).
    const groups = new Map<string, Label[]>();
    for (const l of labels) {
      const key = l.label_product_id || `name:${l.product_name.toLowerCase().trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(l);
    }

    // Índice de recebimentos por produto.
    const receiptsByProduct = new Map<string, ReceiptSummary[]>();
    for (const r of receipts) {
      for (const it of r.items || []) {
        const key = it.product_id || `name:${(it.raw_name || "").toLowerCase().trim()}`;
        if (!receiptsByProduct.has(key)) receiptsByProduct.set(key, []);
        receiptsByProduct.get(key)!.push({
          receipt_id: r.id,
          received_at: r.received_at,
          supplier_name: r.supplier?.name ?? null,
          quantity: Number(it.quantity) || 0,
          unit: it.unit,
          labels_prepared: Number(it.labels_prepared) || 0,
          batch: null,
          expiry_date: null,
        });
      }
    }

    const out: LabeledProduct[] = [];
    for (const [key, list] of groups) {
      const productId = key.startsWith("name:") ? null : key;
      const prod = productId ? productMap.get(productId) ?? null : null;
      const sorted = [...list].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const first = sorted[0];
      const receiptsForProd = (receiptsByProduct.get(key) || []).sort(
        (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
      );
      const active = list.filter((l) => l.status !== "discharged");
      const activeNonExpired = active.filter(
        (l) => classifyExpiry(l.expiry_date) !== "expired",
      );
      const sumUnits = (arr: typeof active) =>
        arr.reduce(
          (acc, l: any) =>
            acc + Math.max(0, Number(l.quantity ?? 1) - Number(l.units_used ?? 0)),
          0,
        );
      const activeUnits = sumUnits(active);
      const activeUnitsNonExpired = sumUnits(activeNonExpired);
      const activeSorted = [...active].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const discharged = list.filter((l) => l.status === "discharged");
      const lastDischarged = discharged.sort(
        (a, b) => new Date(b.resolved_at || b.created_at).getTime() - new Date(a.resolved_at || a.created_at).getTime()
      )[0];
      out.push({
        product_id: productId,
        product_name: prod?.name ?? first.product_name,
        sector: prod?.storage_location ?? first.storage_location ?? null,
        category: prod?.category ?? first.product_category ?? null,
        status: computeStatus(list),
        labels_count: list.length,
        active_labels_count: active.length,
        active_non_expired_labels_count: activeNonExpired.length,
        active_units: activeUnits,
        active_units_non_expired: activeUnitsNonExpired,
        discharged_labels_count: discharged.length,
        active_label_ids: active.map((l) => l.id),
        last_discharge_at: lastDischarged?.resolved_at ?? null,
        last_discharge_reason: lastDischarged?.discharge_reason ?? null,
        receipts_count: receiptsForProd.length,
        last_receipt_at: receiptsForProd[0]?.received_at ?? first.created_at,
        last_label_at: activeSorted[0]?.created_at ?? null,
        last_supplier: receiptsForProd[0]?.supplier_name ?? null,
        last_expiry: first.expiry_date ?? null,
        raw: prod,
        receipts: receiptsForProd,
      });
    }
    // Ordena por status pior → nome
    const rank = { expired: 0, critical: 1, warning: 2, ok: 3 };
    out.sort((a, b) => {
      const s = rank[a.status] - rank[b.status];
      if (s !== 0) return s;
      return a.product_name.localeCompare(b.product_name);
    });
    return out;
  }, [labels, products, receipts]);

  return {
    items: data,
    isLoading: labelsLoading || recLoading,
  };
}
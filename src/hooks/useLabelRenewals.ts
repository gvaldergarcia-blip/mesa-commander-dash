import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { useLabels, type Label } from "@/hooks/useLabels";
import { useLabelProducts, type LabelProduct } from "@/hooks/useLabelProducts";

/** Prefixos de lote que identificam uma etiqueta de Manipulação. */
const MANIPULATION_PREFIX = /^MAN-/i;

const LOOKAHEAD_KEY = "mesaclik:label-renewal-lookahead-hours";
export const DEFAULT_LOOKAHEAD_HOURS = 12;

export type RenewalUrgency = "expired" | "today" | "soon";

export interface RenewalItem {
  label: Label;
  product: LabelProduct | null;
  urgency: RenewalUrgency;
  /** ms restantes (negativo quando já vencida) */
  msLeft: number;
  /** Pode ser renovada automaticamente? */
  renewable: boolean;
  /** Motivo do bloqueio quando não renovável. */
  blockReason: string | null;
  /** Nova validade que será aplicada se renovada agora. */
  nextExpiry: Date | null;
  ruleLabel: string | null;
}

function addRule(base: Date, value: number, unit: string): Date {
  if (unit === "months") {
    const d = new Date(base);
    d.setMonth(d.getMonth() + value);
    return d;
  }
  const ms = unit === "hours" ? value * 3600_000 : value * 86_400_000;
  return new Date(base.getTime() + ms);
}

function ruleText(value: number, unit: string): string {
  if (unit === "hours") return `${value} hora${value === 1 ? "" : "s"}`;
  if (unit === "months") return `${value} ${value === 1 ? "mês" : "meses"}`;
  return `${value} dia${value === 1 ? "" : "s"}`;
}

export function useLabelRenewals() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();
  const { labels, isLoading } = useLabels();
  const { products } = useLabelProducts();
  const [renewing, setRenewing] = useState(false);

  const [lookaheadHours, setLookaheadHoursState] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LOOKAHEAD_KEY) : null;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LOOKAHEAD_HOURS;
  });
  const setLookaheadHours = useCallback((h: number) => {
    setLookaheadHoursState(h);
    try { window.localStorage.setItem(LOOKAHEAD_KEY, String(h)); } catch { /* ignore */ }
  }, []);

  const productById = useMemo(() => {
    const m = new Map<string, LabelProduct>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const items = useMemo<RenewalItem[]>(() => {
    const now = Date.now();
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const horizon = Math.max(
      endOfToday.getTime(),
      now + lookaheadHours * 3600_000,
    );

    const out: RenewalItem[] = [];
    for (const l of labels) {
      if (l.status === "discharged") continue;
      if (!MANIPULATION_PREFIX.test(l.batch || "")) continue;
      const exp = new Date(l.expiry_date).getTime();
      if (!Number.isFinite(exp)) continue;
      if (exp > horizon) continue;
      // Produto totalmente consumido não precisa de nova etiqueta.
      if ((l.units_remaining ?? 0) <= 0) continue;

      const product = l.label_product_id ? productById.get(l.label_product_id) ?? null : null;
      const value = Number(product?.manipulation_validity_value || 0);
      const unit = product?.manipulation_validity_unit || null;

      let renewable = false;
      let blockReason: string | null = null;
      let nextExpiry: Date | null = null;
      let ruleLabel: string | null = null;

      if (!product) {
        blockReason = "Produto sem cadastro vinculado";
      } else if (!product.manipulation_enabled) {
        blockReason = "Renovação não habilitada no cadastro";
      } else if (unit === "immediate") {
        blockReason = "Fabricante exige consumo imediato após aberto";
      } else if (value > 0 && (unit === "hours" || unit === "days" || unit === "months")) {
        renewable = true;
        nextExpiry = addRule(new Date(), value, unit);
        ruleLabel = ruleText(value, unit);
      } else {
        blockReason = "Regra após abertura não configurada";
      }

      const msLeft = exp - now;
      const urgency: RenewalUrgency =
        msLeft < 0 ? "expired" : exp <= endOfToday.getTime() ? "today" : "soon";

      out.push({ label: l, product, urgency, msLeft, renewable, blockReason, nextExpiry, ruleLabel });
    }
    return out.sort((a, b) => a.msLeft - b.msLeft);
  }, [labels, productById, lookaheadHours]);

  const renewableItems = useMemo(() => items.filter((i) => i.renewable), [items]);

  /** Registra uma nova Manipulação (novo lote MAN-) preservando o histórico. */
  const renewOne = useCallback(async (item: RenewalItem) => {
    if (!restaurantId) throw new Error("Restaurante não identificado");
    if (!item.renewable) throw new Error("Etiqueta não pode ser renovada automaticamente");
    const l = item.label;

    // A validade NUNCA é copiada da etiqueta anterior nem de um cálculo antigo:
    // é sempre recalculada no instante exato da renovação usando a regra "Após abertura".
    const manufacture = new Date();
    const ruleValue = Number(item.product?.manipulation_validity_value || 0);
    const ruleUnit = item.product?.manipulation_validity_unit || "";
    if (!(ruleValue > 0) || !["hours", "days", "months"].includes(ruleUnit)) {
      throw new Error("Regra após abertura não configurada para este produto");
    }
    const expiry = addRule(manufacture, ruleValue, ruleUnit);

    let batch = `MAN-${Date.now().toString(36).toUpperCase()}`;
    try {
      const { data: gen } = await (supabase as any).rpc("label_generate_manipulation_lot");
      if (typeof gen === "string" && gen) batch = gen;
    } catch { /* fallback local */ }

    const quantity = Math.max(1, Number(l.units_remaining ?? l.quantity ?? 1));

    const { data: inserted, error } = await (supabase as any)
      .from("label_issuances")
      .insert({
        restaurant_id: restaurantId,
        label_product_id: l.label_product_id,
        product_name: l.product_name,
        manufacture_date: manufacture.toISOString(),
        expiry_date: expiry.toISOString(),
        // A VALIDADE ORIGINAL DO FABRICANTE É APENAS COPIADA — nunca recalculada nem substituída.
        original_expiry_date: (l as any).original_expiry_date ?? null,
        quantity,
        batch,
        responsible: l.responsible,
        employee_id: l.employee_id,
        conservation_method: l.conservation_method,
        notes: `[Renovação] Nova manipulação em ${manufacture.toLocaleString("pt-BR")} · regra após abertura ${ruleText(ruleValue, ruleUnit)} · etiqueta anterior ${l.batch || "—"}`,
        cif: l.cif,
        allergens: l.allergens,
        ingredients: l.ingredients,
        sif: l.sif,
        storage_location: l.storage_location,
        weight: l.weight,
        weight_unit: l.weight_unit,
        supplier_id: (l as any).supplier_id ?? null,
        supplier_lot: (l as any).supplier_lot ?? null,
        traceability_lot: (l as any).traceability_lot ?? null,
        origin_traceability_lot:
          (l as any).origin_traceability_lot ?? (l as any).traceability_lot ?? l.batch ?? null,
        lot_source: (l as any).lot_source ?? null,
        origin_issuance_id: l.id,
      })
      .select("*")
      .single();
    if (error) throw error;

    // O registro anterior NUNCA é apagado — apenas encerrado, mantendo o histórico.
    await (supabase as any)
      .from("label_issuances")
      .update({ status: "discharged", discharge_reason: "vencimento", resolved_at: manufacture.toISOString() })
      .eq("id", l.id);

    return { previous: l, created: inserted, batch, manufacture, expiry };
  }, [restaurantId]);

  const renewMany = useCallback(async (list: RenewalItem[]) => {
    setRenewing(true);
    try {
      const results = [] as Awaited<ReturnType<typeof renewOne>>[];
      for (const it of list) {
        if (!it.renewable) continue;
        results.push(await renewOne(it));
      }
      qc.invalidateQueries({ queryKey: ["labels", restaurantId] });
      qc.invalidateQueries({ queryKey: ["operational-diary", restaurantId] });
      return results;
    } finally {
      setRenewing(false);
    }
  }, [renewOne, qc, restaurantId]);

  return {
    items,
    renewableItems,
    count: items.length,
    renewableCount: renewableItems.length,
    isLoading,
    renewing,
    renewMany,
    lookaheadHours,
    setLookaheadHours,
  };
}

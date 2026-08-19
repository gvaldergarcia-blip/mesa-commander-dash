import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { useLabels, type Label } from "@/hooks/useLabels";
import { useLabelProducts, type LabelProduct } from "@/hooks/useLabelProducts";

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
  /** Validade ORIGINAL do fabricante deste ciclo (resolvida, nunca recalculada). */
  originalExpiry: Date | null;
  /** Lote original do ciclo (imutável durante a renovação). */
  cycleLot: string | null;
  /** Identificador do ciclo (lote raiz de rastreabilidade). */
  cycleId: string | null;
  /** A validade original foi atingida — exige NOVO ciclo, não renovação. */
  cycleEnded: boolean;
}

/** Produto cujo ciclo original venceu e precisa ser reetiquetado (novo ciclo). */
export interface EndedCycleProduct {
  productId: string | null;
  productName: string;
  previousLot: string | null;
  previousOriginalExpiry: Date | null;
  labelIds: string[];
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

    // Fallback de "valor original": etiquetas antigas podem não ter gravado
    // original_expiry_date. Recuperamos pelo mesmo ciclo (produto + lote).
    const originalByCycle = new Map<string, string>();
    for (const l of labels) {
      const raw = (l as any).original_expiry_date;
      if (!raw) continue;
      const key = `${l.label_product_id || l.product_name}::${(l as any).origin_traceability_lot || l.batch || ""}`;
      if (!originalByCycle.has(key)) originalByCycle.set(key, raw);
    }
    const resolveOriginal = (l: Label): Date | null => {
      const raw =
        (l as any).original_expiry_date ??
        originalByCycle.get(`${l.label_product_id || l.product_name}::${(l as any).origin_traceability_lot || l.batch || ""}`) ??
        null;
      if (!raw) return null;
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const out: RenewalItem[] = [];
    for (const l of labels) {
      if (l.status === "discharged") continue;
      const exp = new Date(l.expiry_date).getTime();
      if (!Number.isFinite(exp)) continue;
      if (exp > horizon) continue;
      // Produto totalmente consumido não precisa de nova etiqueta.
      if ((l.units_remaining ?? 0) <= 0) continue;

      const product = l.label_product_id ? productById.get(l.label_product_id) ?? null : null;
      // Regra ativa: "após abertura/manipulação" quando habilitada; senão a validade padrão do cadastro.
      const hasManipRule =
        !!product?.manipulation_enabled && Number(product?.manipulation_validity_value || 0) > 0;
      const value = hasManipRule
        ? Number(product!.manipulation_validity_value)
        : Number(product?.validity_days || 0);
      const unit = hasManipRule
        ? product!.manipulation_validity_unit || "days"
        : product?.validity_days
          ? "days"
          : null;

      let renewable = false;
      let blockReason: string | null = null;
      let nextExpiry: Date | null = null;
      let ruleLabel: string | null = null;

      const originalExp = resolveOriginal(l);
      const cycleEnded = !!originalExp && originalExp.getTime() <= now;
      // Validade ORIGINAL vencida = fim do ciclo. Não é renovação: exige novo
      // ciclo em "Imprimir etiqueta". Some da tela de Renovação.
      if (cycleEnded) continue;

      if (!product) {
        blockReason = "Produto sem cadastro vinculado";
      } else if (product.manipulation_validity_unit === "immediate" && product.manipulation_enabled) {
        blockReason = "Fabricante exige consumo imediato após aberto";
      } else if (cycleEnded) {
        blockReason = "Validade original atingida — inicie um novo ciclo em Imprimir etiqueta";
      } else if (value > 0 && (unit === "hours" || unit === "days" || unit === "months")) {
        renewable = true;
        nextExpiry = addRule(new Date(), value, unit);
        // A nova validade de manipulação nunca ultrapassa a validade original do fabricante.
        if (originalExp && originalExp < nextExpiry) nextExpiry = originalExp;
        ruleLabel = ruleText(value, unit);
      } else {
        blockReason = "Regra de validade não configurada no cadastro do produto";
      }

      const msLeft = exp - now;
      const urgency: RenewalUrgency =
        msLeft < 0 ? "expired" : exp <= endOfToday.getTime() ? "today" : "soon";

      out.push({
        label: l,
        product,
        urgency,
        msLeft,
        renewable,
        blockReason,
        nextExpiry,
        ruleLabel,
        originalExpiry: originalExp,
        cycleLot: l.batch ?? null,
        cycleId: (l as any).origin_traceability_lot ?? (l as any).traceability_lot ?? l.batch ?? null,
        cycleEnded,
      });
    }
    return out.sort((a, b) => a.msLeft - b.msLeft);
  }, [labels, productById, lookaheadHours]);

  const renewableItems = useMemo(() => items.filter((i) => i.renewable), [items]);

  /** Produtos cujo VALOR ORIGINAL já foi atingido — precisam de novo ciclo (novo lote + novo valor original). */
  const endedCycles = useMemo<EndedCycleProduct[]>(() => {
    const now = Date.now();
    const map = new Map<string, EndedCycleProduct>();
    for (const l of labels) {
      if (l.status === "discharged") continue;
      if ((l.units_remaining ?? 0) <= 0) continue;
      const raw = (l as any).original_expiry_date;
      if (!raw) continue;
      const orig = new Date(raw);
      if (Number.isNaN(orig.getTime()) || orig.getTime() > now) continue;
      const key = `${l.label_product_id || l.product_name}`;
      const cur = map.get(key);
      if (cur) {
        cur.labelIds.push(l.id);
        continue;
      }
      map.set(key, {
        productId: l.label_product_id ?? null,
        productName: l.product_name,
        previousLot: l.batch ?? null,
        previousOriginalExpiry: orig,
        labelIds: [l.id],
      });
    }
    return Array.from(map.values());
  }, [labels]);

  /** Registra uma nova Manipulação (novo lote MAN-) preservando o histórico. */
  const renewOne = useCallback(async (item: RenewalItem) => {
    if (!restaurantId) throw new Error("Restaurante não identificado");
    if (!item.renewable) throw new Error("Etiqueta não pode ser renovada automaticamente");
    const l = item.label;

    // A validade NUNCA é copiada da etiqueta anterior nem de um cálculo antigo:
    // é sempre recalculada no instante exato da renovação usando a regra "Após abertura".
    const manufacture = new Date();
    const p = item.product;
    const hasManipRule = !!p?.manipulation_enabled && Number(p?.manipulation_validity_value || 0) > 0;
    const ruleValue = hasManipRule ? Number(p!.manipulation_validity_value) : Number(p?.validity_days || 0);
    const ruleUnit = hasManipRule ? (p!.manipulation_validity_unit || "days") : "days";
    if (!(ruleValue > 0) || !["hours", "days", "months"].includes(ruleUnit)) {
      throw new Error("Regra de validade não configurada para este produto");
    }
    let expiry = addRule(manufacture, ruleValue, ruleUnit);
    const originalExp = (l as any).original_expiry_date ? new Date((l as any).original_expiry_date) : null;
    if (originalExp && originalExp.getTime() <= manufacture.getTime()) {
      throw new Error("Validade original do fabricante já venceu — não é possível renovar");
    }
    if (originalExp && originalExp < expiry) expiry = originalExp;

    // RENOVAÇÃO = MESMO CICLO. O lote original NUNCA muda.
    const batch = l.batch ?? null;

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
        original_expiry_date:
          (l as any).original_expiry_date ?? (item.originalExpiry ? item.originalExpiry.toISOString() : null),
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
    endedCycles,
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

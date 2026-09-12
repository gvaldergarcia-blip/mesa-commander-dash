import type { Label } from "@/hooks/useLabels";
import type { RenewalItem } from "@/hooks/useLabelRenewals";

export type OperationalView = "expired" | "tomorrow" | "renewal" | "ok";

function cycleKey(label: Label) {
  const traceability = (label as Label & { origin_traceability_lot?: string | null }).origin_traceability_lot;
  return `${label.label_product_id || label.product_name}::${traceability || label.batch || ""}`;
}

export function buildOriginalExpiryResolver(labels: Label[]) {
  const originalByCycle = new Map<string, string>();
  const rootByCycle = new Map<string, { created: number; expiry: string }>();

  for (const label of labels) {
    const key = cycleKey(label);
    if (label.original_expiry_date && !originalByCycle.has(key)) {
      originalByCycle.set(key, label.original_expiry_date);
    }
    const created = new Date(label.created_at).getTime();
    const current = rootByCycle.get(key);
    if (Number.isFinite(created) && (!current || created < current.created)) {
      rootByCycle.set(key, { created, expiry: label.expiry_date });
    }
  }

  return (label: Label): Date | null => {
    const raw = label.original_expiry_date
      ?? originalByCycle.get(cycleKey(label))
      ?? rootByCycle.get(cycleKey(label))?.expiry
      ?? null;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  };
}

export function getOperationalGroups(labels: Label[], renewalItems: RenewalItem[]) {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setHours(0, 0, 0, 0);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const afterTomorrow = new Date(tomorrowStart);
  afterTomorrow.setDate(afterTomorrow.getDate() + 1);

  const resolveOriginal = buildOriginalExpiryResolver(labels);
  const active = labels.filter(
    (label) => label.status !== "discharged" && Number(label.units_remaining ?? 0) > 0,
  );

  const groups = new Map<string, Label[]>();
  for (const label of active) {
    const key = label.label_product_id || `name:${label.product_name.toLowerCase().trim()}`;
    const group = groups.get(key) ?? [];
    group.push(label);
    groups.set(key, group);
  }

  const expired: Label[] = [];
  const tomorrow: Label[] = [];
  const ok: Label[] = [];
  const renewal: RenewalItem[] = [];

  for (const productLabels of groups.values()) {
    const ordered = [...productLabels].sort((a, b) => {
      const aTime = resolveOriginal(a)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = resolveOriginal(b)?.getTime() ?? Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
    const expiredLabel = ordered.find((label) => {
      const original = resolveOriginal(label);
      return original && original.getTime() <= now.getTime();
    });
    if (expiredLabel) {
      expired.push(expiredLabel);
      continue;
    }
    const tomorrowLabel = ordered.find((label) => {
      const original = resolveOriginal(label);
      return original && original >= tomorrowStart && original < afterTomorrow;
    });
    if (tomorrowLabel) {
      tomorrow.push(tomorrowLabel);
      continue;
    }
    const renewalItem = renewalItems.find(
      (item) => productLabels.some((label) => label.id === item.label.id)
        && item.renewable
        && (item.urgency === "expired" || item.urgency === "today"),
    );
    if (renewalItem) {
      renewal.push(renewalItem);
      continue;
    }
    const newest = [...productLabels].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
    if (newest) ok.push(newest);
  }

  const byOriginalExpiry = (a: Label, b: Label) => {
    const aTime = resolveOriginal(a)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = resolveOriginal(b)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  };

  expired.sort(byOriginalExpiry);
  tomorrow.sort(byOriginalExpiry);
  ok.sort((a, b) => a.product_name.localeCompare(b.product_name, "pt-BR"));

  return {
    expired,
    tomorrow,
    renewal,
    ok,
    resolveOriginal,
  };
}
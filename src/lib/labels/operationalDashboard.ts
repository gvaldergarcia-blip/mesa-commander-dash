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
  const renewalIds = new Set(
    renewalItems
      .filter((item) => item.renewable && (item.urgency === "expired" || item.urgency === "today"))
      .map((item) => item.label.id),
  );
  const active = labels.filter(
    (label) => label.status !== "discharged" && Number(label.units_remaining ?? 0) > 0,
  );

  const expired: Label[] = [];
  const tomorrow: Label[] = [];
  const ok: Label[] = [];

  for (const label of active) {
    const original = resolveOriginal(label);
    if (original && original.getTime() <= now.getTime()) {
      expired.push(label);
      continue;
    }
    if (original && original >= tomorrowStart && original < afterTomorrow) {
      tomorrow.push(label);
      continue;
    }
    if (!renewalIds.has(label.id)) ok.push(label);
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
    renewal: renewalItems.filter(
      (item) => item.renewable && (item.urgency === "expired" || item.urgency === "today"),
    ),
    ok,
    resolveOriginal,
  };
}
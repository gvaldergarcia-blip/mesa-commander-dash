interface CycleLabel {
  label_product_id?: string | null;
  product_name: string;
  origin_traceability_lot?: string | null;
  batch?: string | null;
  original_expiry_date?: string | null;
  created_at: string;
  expiry_date: string;
  status?: string;
  units_remaining?: number | null;
}

const cycleKey = (label: CycleLabel) =>
  `${label.label_product_id || label.product_name}::${label.origin_traceability_lot || label.batch || ""}`;

/** Resolve the earliest valid manufacturer expiry across the entire cycle. */
export function buildOriginalExpiryResolver(labels: CycleLabel[]) {
  const originals = new Map<string, number>();
  const roots = new Map<string, { created: number; expiry: string }>();
  for (const label of labels) {
    const key = cycleKey(label);
    const original = label.original_expiry_date ? new Date(label.original_expiry_date).getTime() : NaN;
    if (Number.isFinite(original)) {
      originals.set(key, Math.min(original, originals.get(key) ?? Infinity));
    }
    const created = new Date(label.created_at).getTime();
    const root = roots.get(key);
    if (Number.isFinite(created) && (!root || created < root.created)) {
      roots.set(key, { created, expiry: label.expiry_date });
    }
  }
  return (label: CycleLabel): Date | null => {
    const key = cycleKey(label);
    const original = originals.get(key);
    if (original !== undefined) return new Date(original);
    const root = roots.get(key);
    const date = root ? new Date(root.expiry) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  };
}

export function isRenewalCandidate(label: CycleLabel, originalExpiry: Date | null, now: number, horizon: number) {
  const expiry = new Date(label.expiry_date).getTime();
  return label.status !== "discharged"
    && Number(label.units_remaining ?? 0) > 0
    && Number.isFinite(expiry) && expiry <= horizon
    && (!originalExpiry || originalExpiry.getTime() > now);
}
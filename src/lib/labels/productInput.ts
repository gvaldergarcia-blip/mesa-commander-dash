import type { LabelProductInput } from "@/hooks/useLabelProducts";

/** Mesma regra do formulário de cadastro: validade pós-abertura obrigatória;
 *  validity_days derivado dela (horas → 1 dia). */
export function buildQuickProductInput(f: {
  name: string;
  unit: string;
  supplierName?: string | null;
  category?: string | null;
  conservation: string;
  storageLocation?: string | null;
  manipValue: string;
  manipUnit: "days" | "hours";
}): { input?: LabelProductInput; error?: string } {
  const trimmed = f.name.trim();
  if (!trimmed) return { error: "Informe o nome" };
  const manip = Number(f.manipValue.trim());
  if (!Number.isSafeInteger(manip) || manip < 1) return { error: "Informe a validade pós-abertura deste produto em dias ou horas" };
  return {
    input: {
      name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
      validity_days: f.manipUnit === "hours" ? 1 : manip,
      conservation_method: f.conservation as any,
      unit: f.unit || "un",
      status: "active",
      category: f.category || null,
      supplier_name: f.supplierName?.trim() || null,
      storage_location: f.storageLocation?.trim() || null,
      auto_reprint_enabled: true,
      manipulation_enabled: true,
      manipulation_validity_value: manip,
      manipulation_validity_unit: f.manipUnit,
      origin: "received",
    },
  };
}

export const normAlias = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

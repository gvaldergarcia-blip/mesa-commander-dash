import { Label } from "@/hooks/useLabels";

export const CONSERVATION_LABEL: Record<string, string> = {
  refrigerated: "Resfriado",
  frozen: "Congelado",
  ambient: "Ambiente",
  hot: "Quente",
};

export const REASON_LABEL: Record<string, string> = {
  use: "Baixa por Uso",
  loss: "Baixa por Perda",
  error: "Baixa por Erro",
};

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export type DayClass = "expired" | "today" | "tomorrow" | "future";

export function classifyExpiry(expiry: string | Date): DayClass {
  const now = new Date();
  const exp = new Date(expiry);
  const today = startOfDay(now);
  const tomorrow = startOfDay(new Date(today.getTime() + 24 * 3600 * 1000));
  const afterTomorrow = startOfDay(new Date(today.getTime() + 48 * 3600 * 1000));
  if (exp < now) return "expired";
  if (exp >= today && exp < tomorrow) return "today";
  if (exp >= tomorrow && exp < afterTomorrow) return "tomorrow";
  return "future";
}

/**
 * Fonte única da verdade para o status efetivo de uma etiqueta.
 * Substitui computeLiveStatus.
 */
export function getLabelEffectiveStatus(l: { status: string; expiry_date: string | Date }): "active" | "expired" | "discharged" {
  if (l.status === "discharged") return "discharged";
  if (new Date(l.expiry_date) < new Date()) return "expired";
  return "active";
}

export interface LabelStats {
  expired: number;
  today: number;
  tomorrow: number;
  monthTotal: number;
}

export function computeStats(labels: Label[]): LabelStats {
  const stats: LabelStats = { expired: 0, today: 0, tomorrow: 0, monthTotal: 0 };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  labels.forEach((l) => {
    if (l.status === "discharged") {
      // still counts toward month total
      if (new Date(l.created_at) >= monthStart) stats.monthTotal++;
      return;
    }
    const c = classifyExpiry(l.expiry_date);
    if (c === "expired") stats.expired++;
    else if (c === "today") stats.today++;
    else if (c === "tomorrow") stats.tomorrow++;
    if (new Date(l.created_at) >= monthStart) stats.monthTotal++;
  });
  return stats;
}

export function toCsv(labels: Label[]): string {
  const header = [
    "Código","Produto","Funcionário","Fabricação","Validade","Conservação",
    "Quantidade","Lote","Status","Motivo da Baixa","Observação",
  ];
  const rows = labels.map((l) => [
    l.unique_code,
    l.product_name,
    l.employee_name || l.responsible || "",
    new Date(l.manufacture_date).toLocaleString("pt-BR"),
    new Date(l.expiry_date).toLocaleString("pt-BR"),
    CONSERVATION_LABEL[l.conservation_method || ""] || "",
    String(l.quantity),
    l.batch || "",
    l.status,
    l.discharge_reason ? REASON_LABEL[l.discharge_reason] : "",
    (l.notes || "").replace(/\n/g, " "),
  ]);
  const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
import { Snowflake, Flame, Thermometer, Refrigerator, Loader2, Hash, User, Calendar } from "lucide-react";
import { Label } from "@/hooks/useLabels";
import { classifyExpiry, CONSERVATION_LABEL, REASON_LABEL } from "@/lib/labels/utils";
import { getCategoryHex } from "@/lib/labels/categories";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  labels: Label[];
  isLoading: boolean;
}

const conservationIcon = (c: string | null) => {
  switch (c) {
    case "frozen": return Snowflake;
    case "hot": return Flame;
    case "ambient": return Thermometer;
    default: return Refrigerator;
  }
};

const statusPill = (l: Label) => {
  if (l.status === "discharged")
    return { label: "BAIXADO", className: "bg-muted text-muted-foreground" };
  const c = classifyExpiry(l.expiry_date);
  if (l.status === "expired" || c === "expired")
    return { label: "VENCIDO", className: "bg-destructive/15 text-destructive dark:bg-[#7F1D1D] dark:text-[#FECACA]" };
  if (c === "today")
    return { label: "VENCE HOJE", className: "bg-warning/15 text-warning dark:bg-[#7C2D12] dark:text-[#FED7AA]" };
  return { label: "ATIVO", className: "bg-success/15 text-success dark:bg-[#14532D] dark:text-[#BBF7D0]" };
};

const leftBorderColor = (l: Label) => {
  if (l.status === "discharged") return "hsl(var(--border))";
  // Borda colorida sempre por categoria do produto (com fallback "Outros")
  return getCategoryHex(l.product_category);
};

export function LabelsList({ labels, isLoading }: Props) {
  if (isLoading) {
    return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (labels.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
        <Hash className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Nenhuma etiqueta encontrada</p>
        <p className="text-sm mt-1">Ajuste os filtros ou imprima uma nova etiqueta.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-3 px-1">
        {labels.length} etiqueta(s)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {labels.map((l) => {
          const Icon = conservationIcon(l.conservation_method);
          const pill = statusPill(l);
          const isDischarged = l.status === "discharged";
          const expiryClass = classifyExpiry(l.expiry_date);
          const expiryClassName =
            l.status !== "discharged" && (expiryClass === "expired" || l.status === "expired")
              ? "text-destructive"
              : expiryClass === "today"
                ? "text-warning"
                : "text-foreground";
          return (
            <div
              key={l.id}
              className={cn(
                "group relative rounded-xl p-4 transition-all duration-200",
                "bg-card border border-border hover:border-primary",
                isDischarged && "opacity-60"
              )}
              style={{ borderLeftWidth: 4, borderLeftColor: leftBorderColor(l) }}
            >
              {/* Linha 1: nome + status */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-foreground font-bold text-base leading-tight truncate flex-1">
                  {l.product_name}
                </h3>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0",
                    pill.className
                  )}
                >
                  {pill.label}
                </span>
              </div>

              {/* Linha 2: ID + conservação */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="font-mono font-semibold text-primary"
                  style={{ fontSize: 11 }}
                >
                  #{l.unique_code}
                </span>
                <span
                  className="flex items-center gap-1 text-[11px] text-muted-foreground"
                  title={CONSERVATION_LABEL[l.conservation_method || ""] || "—"}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{CONSERVATION_LABEL[l.conservation_method || ""] || "—"}</span>
                </span>
              </div>

              {/* Linha 3: responsável + validade */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{l.employee_name || l.responsible || "—"}</span>
                </span>
                <span
                  className={cn("flex items-center gap-1.5 font-semibold shrink-0", expiryClassName)}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Val: {format(new Date(l.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>

              {l.discharge_reason && (
                <div className="mt-2 pt-2 border-t border-border">
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {REASON_LABEL[l.discharge_reason]}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
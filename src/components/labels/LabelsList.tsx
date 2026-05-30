import { Snowflake, Flame, Thermometer, Refrigerator, Loader2, Hash, User, Calendar } from "lucide-react";
import { Label, DischargeReason } from "@/hooks/useLabels";
import { classifyExpiry, CONSERVATION_LABEL, REASON_LABEL } from "@/lib/labels/utils";
import { getCategoryHex } from "@/lib/labels/categories";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  labels: Label[];
  isLoading: boolean;
  // Mantidos por compatibilidade com EtiquetasPage; sem uso visual (checkboxes removidos).
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onBulkDischarge?: (reason: DischargeReason) => Promise<void>;
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
  if (l.status === "discharged") return { label: "BAIXADO", style: { backgroundColor: "#2D2D44", color: "#A0AEC0" } };
  const c = classifyExpiry(l.expiry_date);
  if (l.status === "expired" || c === "expired")
    return { label: "VENCIDO", style: { backgroundColor: "#7F1D1D", color: "#FECACA" } };
  if (c === "today") return { label: "VENCE HOJE", style: { backgroundColor: "#7C2D12", color: "#FED7AA" } };
  return { label: "ATIVO", style: { backgroundColor: "#14532D", color: "#BBF7D0" } };
};

const leftBorderColor = (l: Label) => {
  if (l.status === "discharged") return "#2D2D44";
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
      <div className="text-xs font-medium text-[#A0AEC0] mb-3 px-1">
        {labels.length} etiqueta(s)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {labels.map((l) => {
          const Icon = conservationIcon(l.conservation_method);
          const pill = statusPill(l);
          const isDischarged = l.status === "discharged";
          const expiryClass = classifyExpiry(l.expiry_date);
          const expiryColor =
            l.status !== "discharged" && (expiryClass === "expired" || l.status === "expired")
              ? "#FCA5A5"
              : expiryClass === "today"
                ? "#FDBA74"
                : "#E2E8F0";
          return (
            <div
              key={l.id}
              className={cn(
                "group relative rounded-xl p-4 transition-all duration-200",
                "bg-[#1A1A2E] border border-[#2D2D44] hover:border-[#FF6B00]",
                isDischarged && "opacity-60"
              )}
              style={{ borderLeftWidth: 4, borderLeftColor: leftBorderColor(l) }}
            >
              {/* Linha 1: nome + status */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-white font-bold text-base leading-tight truncate flex-1">
                  {l.product_name}
                </h3>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                  style={pill.style}
                >
                  {pill.label}
                </span>
              </div>

              {/* Linha 2: ID + conservação */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="font-mono font-semibold"
                  style={{ color: "#FF6B00", fontSize: 11 }}
                >
                  #{l.unique_code}
                </span>
                <span
                  className="flex items-center gap-1 text-[11px] text-[#A0AEC0]"
                  title={CONSERVATION_LABEL[l.conservation_method || ""] || "—"}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{CONSERVATION_LABEL[l.conservation_method || ""] || "—"}</span>
                </span>
              </div>

              {/* Linha 3: responsável + validade */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-[#A0AEC0] min-w-0">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{l.employee_name || l.responsible || "—"}</span>
                </span>
                <span
                  className="flex items-center gap-1.5 font-semibold shrink-0"
                  style={{ color: expiryColor }}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Val: {format(new Date(l.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>

              {l.discharge_reason && (
                <div className="mt-2 pt-2 border-t border-[#2D2D44]">
                  <span className="text-[10px] text-[#A0AEC0] bg-[#2D2D44] px-1.5 py-0.5 rounded">
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
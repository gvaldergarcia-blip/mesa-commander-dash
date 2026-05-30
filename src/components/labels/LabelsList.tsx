import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Snowflake, Flame, Thermometer, Refrigerator, Loader2, Hash, Download, X, Trash2 } from "lucide-react";
import { Label, DischargeReason } from "@/hooks/useLabels";
import { classifyExpiry, CONSERVATION_LABEL, REASON_LABEL, toCsv, downloadCsv } from "@/lib/labels/utils";
import { getCategoryHex } from "@/lib/labels/categories";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  labels: Label[];
  isLoading: boolean;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onBulkDischarge: (reason: DischargeReason) => Promise<void>;
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
  if (l.status === "discharged") return { label: "Baixado", style: { backgroundColor: "#2D2D44", color: "#A0AEC0" } };
  if (l.status === "expired") return { label: "Vencido", style: { backgroundColor: "#7F1D1D", color: "#FECACA" } };
  const c = classifyExpiry(l.expiry_date);
  if (c === "expired") return { label: "Vencido", style: { backgroundColor: "#7F1D1D", color: "#FECACA" } };
  if (c === "today") return { label: "Hoje", style: { backgroundColor: "#78350F", color: "#FDE68A" } };
  if (c === "tomorrow") return { label: "Amanhã", style: { backgroundColor: "#1E3A5F", color: "#BFDBFE" } };
  return { label: "Ativo", style: { backgroundColor: "#14532D", color: "#BBF7D0" } };
};

const leftBorderColor = (l: Label) => {
  if (l.status === "discharged") return "#2D2D44";
  // Borda colorida sempre por categoria do produto (com fallback "Outros")
  return getCategoryHex(l.product_category);
};

export function LabelsList({ labels, isLoading, selected, onSelectedChange, onBulkDischarge }: Props) {
  const [bulkReason, setBulkReason] = useState<DischargeReason | null>(null);

  const toggle = (id: string) => {
    onSelectedChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const toggleAll = () => {
    if (selected.length === labels.length) onSelectedChange([]);
    else onSelectedChange(labels.map((l) => l.id));
  };

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

  const handleExportSelected = () => {
    const subset = labels.filter((l) => selected.includes(l.id));
    if (subset.length === 0) return;
    downloadCsv(`etiquetas-selecionadas-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(subset));
  };

  return (
    <div className="space-y-2">
      {/* Toolbar compacto / barra de ações em massa */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-colors",
          selected.length > 0
            ? "bg-[#1A1A2E] border-[#FF6B00]/60 shadow-lg shadow-[#FF6B00]/10"
            : "bg-[#161626] border-[#2D2D44]"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Checkbox checked={selected.length === labels.length && labels.length > 0} onCheckedChange={toggleAll} />
          <span className="text-xs font-medium text-[#A0AEC0] truncate">
            {selected.length > 0
              ? <><span className="text-[#FF6B00] font-bold">{selected.length}</span> selecionada(s) de {labels.length}</>
              : <>{labels.length} etiqueta(s)</>}
          </span>
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleExportSelected} className="h-8 gap-1.5 text-[#A0AEC0] hover:text-white hover:bg-[#2D2D44]">
              <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button size="sm" onClick={() => setBulkReason("use")} className="h-8 gap-1.5 bg-[#E53E3E] hover:bg-[#C53030] text-white">
              <Trash2 className="h-3.5 w-3.5" /> Baixar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSelectedChange([])} className="h-8 w-8 p-0 text-[#718096] hover:text-white hover:bg-[#2D2D44]" aria-label="Limpar seleção">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Lista compacta — 1 linha por etiqueta */}
      <div className="space-y-1">
        {labels.map((l) => {
          const Icon = conservationIcon(l.conservation_method);
          const pill = statusPill(l);
          const isSelected = selected.includes(l.id);
          const isDischarged = l.status === "discharged";
          return (
            <div
              key={l.id}
              onClick={() => toggle(l.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                isSelected
                  ? "bg-[#1F1F3A] border-[#FF6B00]/60"
                  : "bg-[#1A1A2E] border-[#2D2D44] hover:bg-[#1F1F3A] hover:border-[#3D3D5C]",
                isDischarged && "opacity-60"
              )}
              style={{ borderLeftWidth: 4, borderLeftColor: leftBorderColor(l) }}
            >
              <Checkbox checked={isSelected} onCheckedChange={() => toggle(l.id)} onClick={(e) => e.stopPropagation()} />

              {/* Nome + código */}
              <div className="flex items-center gap-2 min-w-0 flex-[2]">
                <span className="font-semibold text-sm text-white truncate">{l.product_name}</span>
                <span className="font-mono text-[10px] text-[#FF6B00] bg-[#FF6B00]/10 px-1.5 py-0.5 rounded shrink-0">#{l.unique_code}</span>
              </div>

              {/* Meta inline */}
              <div className="hidden md:flex items-center gap-4 text-xs text-[#718096] flex-1 min-w-0">
                <span className="flex items-center gap-1 shrink-0" title={CONSERVATION_LABEL[l.conservation_method || ""] || "—"}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">
                  <span className="text-[#A0AEC0]">{l.employee_name || l.responsible || "—"}</span>
                </span>
                <span className="shrink-0">
                  Val: <span className="text-white font-medium">{format(new Date(l.expiry_date), "dd/MM", { locale: ptBR })}</span>
                </span>
              </div>

              {/* Status pill */}
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                style={pill.style}
              >
                {pill.label}
              </span>
              {l.discharge_reason && (
                <span className="hidden sm:inline text-[10px] text-[#A0AEC0] bg-[#2D2D44] px-1.5 py-0.5 rounded shrink-0">
                  {REASON_LABEL[l.discharge_reason]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!bulkReason} onOpenChange={(o) => !o && setBulkReason(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Baixar {selected.length} etiqueta(s)</AlertDialogTitle>
            <AlertDialogDescription>Escolha o motivo da baixa:</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={bulkReason || "use"} onValueChange={(v) => setBulkReason(v as DischargeReason)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="use">🍽️ Baixa por Uso</SelectItem>
              <SelectItem value="loss">⚠️ Baixa por Perda</SelectItem>
              <SelectItem value="error">✕ Baixa por Erro</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (bulkReason) await onBulkDischarge(bulkReason);
                setBulkReason(null);
              }}
            >Confirmar baixa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
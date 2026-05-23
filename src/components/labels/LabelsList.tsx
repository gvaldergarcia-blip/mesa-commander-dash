import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Snowflake, Flame, Thermometer, Refrigerator, Loader2, Hash } from "lucide-react";
import { Label, DischargeReason } from "@/hooks/useLabels";
import { classifyExpiry, CONSERVATION_LABEL, REASON_LABEL } from "@/lib/labels/utils";
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

const statusBadge = (l: Label) => {
  if (l.status === "discharged") return <Badge variant="secondary">Baixado</Badge>;
  if (l.status === "expired") return <Badge className="bg-destructive text-destructive-foreground">Vencido</Badge>;
  return <Badge className="bg-success text-success-foreground">Ativo</Badge>;
};

const rowClass = (l: Label) => {
  if (l.status === "discharged") return "bg-muted/20 opacity-70";
  const c = classifyExpiry(l.expiry_date);
  if (c === "expired") return "bg-destructive/10 border-l-4 border-l-destructive";
  if (c === "today") return "bg-warning/10 border-l-4 border-l-warning";
  if (c === "tomorrow") return "bg-accent/10 border-l-4 border-l-accent";
  return "";
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
        <div className="flex items-center gap-3">
          <Checkbox checked={selected.length === labels.length && labels.length > 0} onCheckedChange={toggleAll} />
          <span className="text-sm text-muted-foreground">
            {selected.length > 0 ? `${selected.length} selecionada(s)` : `${labels.length} etiqueta(s)`}
          </span>
        </div>
        {selected.length > 0 && (
          <Button size="sm" variant="destructive" onClick={() => setBulkReason("use")} className="gap-2">
            Baixar selecionadas
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {labels.map((l) => {
          const Icon = conservationIcon(l.conservation_method);
          return (
            <div key={l.id} className={cn("flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/40", rowClass(l))}>
              <Checkbox checked={selected.includes(l.id)} onCheckedChange={() => toggle(l.id)} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold truncate">{l.product_name}</span>
                  <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">#{l.unique_code}</span>
                  {statusBadge(l)}
                  {l.discharge_reason && (
                    <Badge variant="outline" className="text-xs">{REASON_LABEL[l.discharge_reason]}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><Icon className="h-3 w-3" /> {CONSERVATION_LABEL[l.conservation_method || ""] || "—"}</span>
                  <span>Resp: <strong className="text-foreground">{l.employee_name || l.responsible || "—"}</strong></span>
                  <span>Fab: {format(new Date(l.manufacture_date), "dd/MM HH:mm", { locale: ptBR })}</span>
                  <span>Val: <strong className="text-foreground">{format(new Date(l.expiry_date), "dd/MM/yyyy", { locale: ptBR })}</strong></span>
                  {l.batch && <span>Lote: {l.batch}</span>}
                </div>
              </div>
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
import { useMemo } from "react";
import { useLabelMovements } from "@/hooks/useReceipts";
import { useLabels } from "@/hooks/useLabels";
import { Button } from "@/components/ui/button";
import { PackagePlus, Printer, PackageX, RefreshCw, ArrowRightLeft, Sparkles, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { printLabels } from "../LabelPrintSheet";

const EVENT_META: Record<string, { label: string; icon: any; color: string }> = {
  receipt: { label: "Recebimento", icon: PackagePlus, color: "text-emerald-500" },
  label_issued: { label: "Etiqueta emitida", icon: Printer, color: "text-blue-500" },
  discharge: { label: "Baixa", icon: PackageX, color: "text-slate-500" },
  waste: { label: "Perda", icon: PackageX, color: "text-destructive" },
  transfer: { label: "Transferência", icon: ArrowRightLeft, color: "text-amber-500" },
  adjustment: { label: "Ajuste", icon: RefreshCw, color: "text-muted-foreground" },
};

export function OperationalDiary() {
  const { data: movements, isLoading } = useLabelMovements(150);
  const { labels } = useLabels();

  const labelsById = useMemo(() => {
    const m = new Map<string, typeof labels[number]>();
    labels.forEach((l) => m.set(l.id, l));
    return m;
  }, [labels]);

  const handlePrint = (labelId: string) => {
    const l = labelsById.get(labelId);
    if (!l) return;
    printLabels({
      productName: l.product_name,
      manufactureDate: new Date(l.manufacture_date),
      expiryDate: new Date(l.expiry_date),
      responsible: l.responsible || l.employee_name || "—",
      quantity: l.quantity || 1,
      notes: l.notes,
      cif: l.cif,
      allergens: l.allergens,
      ingredients: l.ingredients,
      conservationLabel:
        l.conservation_method === "refrigerated" ? "Refrigerado" :
        l.conservation_method === "frozen" ? "Congelado" :
        l.conservation_method === "hot" ? "Quente" :
        l.conservation_method === "ambient" ? "Ambiente" : null,
      batch: l.batch,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!movements || movements.length === 0) {
    return (
      <div className="text-center py-14 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
        <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">O diário operacional aparece aqui automaticamente</p>
        <p className="text-xs mt-1">Cada recebimento, etiqueta e baixa é registrada sem esforço.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="divide-y divide-border">
        {movements.map((m: any) => {
          const meta = EVENT_META[m.event_type] ?? EVENT_META.adjustment;
          const Icon = meta.icon;
          return (
            <div key={m.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
              <div className={`p-2 rounded-lg bg-muted ${meta.color} shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{meta.label}</span>
                  {m.product?.name && <span className="text-sm text-muted-foreground">— {m.product.name}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  {m.quantity && <span>{Number(m.quantity)} {m.unit || ""}</span>}
                  {m.supplier?.name && <span>· {m.supplier.name}</span>}
                  {m.notes && <span className="truncate">· {m.notes}</span>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(m.occurred_at), { addSuffix: true, locale: ptBR })}
              </div>
              {m.event_type === "label_issued" && m.issuance_id && labelsById.has(m.issuance_id) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePrint(m.issuance_id)}
                  className="h-7 px-2 gap-1 text-xs shrink-0"
                >
                  <Printer className="h-3 w-3" />
                  Imprimir
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
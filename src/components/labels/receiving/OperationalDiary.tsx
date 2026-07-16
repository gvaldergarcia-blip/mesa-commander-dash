import { useLabelMovements } from "@/hooks/useReceipts";
import { PackagePlus, Printer, PackageX, RefreshCw, ArrowRightLeft, Sparkles, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PackagePlus,
  Printer,
  Trash2,
  ClipboardCheck,
  ShoppingCart,
  Package,
  ArrowLeftRight,
  ChefHat,
  AlertTriangle,
  Loader2,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOperationalDiary, OperationalEvent, KitchenEventType } from "@/hooks/useOperationalDiary";
import { useLabels } from "@/hooks/useLabels";
import { useStockStatus } from "@/hooks/useStockStatus";
import { classifyExpiry } from "@/lib/labels/utils";
import { printLabels } from "./LabelPrintSheet";
import { cn } from "@/lib/utils";

interface Props {
  onQuickAction: (action: "new-label" | "new-receipt" | "shopping" | "labels") => void;
}

const EVENT_META: Record<
  KitchenEventType,
  { label: string; color: string; bg: string; icon: any }
> = {
  receipt:          { label: "Recebimento",       color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", icon: PackagePlus },
  label_issued:     { label: "Etiqueta emitida",  color: "text-primary",     bg: "bg-primary/10 border-primary/20",         icon: Printer },
  label_discharged: { label: "Baixa de etiqueta", color: "text-orange-500",  bg: "bg-orange-500/10 border-orange-500/20",   icon: Trash2 },
  stock_check:      { label: "Checagem estoque",  color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/20",       icon: ClipboardCheck },
  consumption:      { label: "Consumo",           color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/20",     icon: ChefHat },
  loss:             { label: "Perda",             color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", icon: AlertTriangle },
  transfer:         { label: "Transferência",     color: "text-purple-500",  bg: "bg-purple-500/10 border-purple-500/20",   icon: ArrowLeftRight },
  manipulation:     { label: "Manipulação",       color: "text-indigo-500",  bg: "bg-indigo-500/10 border-indigo-500/20",   icon: Package },
  purchase_request: { label: "Sugestão compra",   color: "text-cyan-500",    bg: "bg-cyan-500/10 border-cyan-500/20",       icon: ShoppingCart },
};

function describe(e: OperationalEvent): string {
  const p = e.payload || {};
  const name = e.product_name || p.product_name || "";
  switch (e.event_type) {
    case "receipt":
      return e.supplier_name
        ? `Recebimento de ${e.supplier_name}${p.reference ? ` — NF ${p.reference}` : ""}`
        : `Recebimento registrado${p.reference ? ` — NF ${p.reference}` : ""}`;
    case "label_issued":
      return name ? `${name} etiquetada${e.quantity ? ` (${e.quantity} un)` : ""}` : "Etiqueta emitida";
    case "label_discharged":
      return `${name || "Etiqueta"} baixada${p.reason ? ` — ${p.reason}` : ""}`;
    case "stock_check":
      return `${name || p.product_name} marcado como ${p.status === "missing" ? "falta" : "ok"}`;
    case "consumption":
      return `${name}${e.quantity ? ` — ${e.quantity}${e.unit || ""}` : ""} consumido`;
    case "loss":
      return `${name} descartado por perda`;
    default:
      return name || EVENT_META[e.event_type].label;
  }
}

export function TodayTab({ onQuickAction }: Props) {
  const { events, isLoading } = useOperationalDiary({ limit: 150 });
  const { labels } = useLabels();
  const { missingProducts } = useStockStatus();

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

  const now = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const alerts = useMemo(() => {
    const active = labels.filter((l) => l.status !== "discharged");
    const expired  = active.filter((l) => classifyExpiry(l.expiry_date) === "expired");
    const today    = active.filter((l) => classifyExpiry(l.expiry_date) === "today");
    const tomorrow = active.filter((l) => classifyExpiry(l.expiry_date) === "tomorrow");
    return { expired, today, tomorrow };
  }, [labels]);

  const todayEvents = useMemo(
    () => events.filter((e) => new Date(e.occurred_at) >= startOfToday),
    [events]
  );

  const summary = useMemo(() => {
    const count = (t: KitchenEventType) => todayEvents.filter((e) => e.event_type === t).length;
    return {
      receipts:    count("receipt"),
      issued:      count("label_issued"),
      discharged:  count("label_discharged"),
      checks:      count("stock_check"),
    };
  }, [todayEvents]);

  return (
    <div className="space-y-5">
      {/* Ações rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          size="lg"
          onClick={() => onQuickAction("new-receipt")}
          className="h-auto py-4 flex-col gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
        >
          <PackagePlus className="h-5 w-5" />
          <span className="text-xs font-semibold">Novo recebimento</span>
        </Button>
        <Button
          size="lg"
          onClick={() => onQuickAction("new-label")}
          className="h-auto py-4 flex-col gap-1.5 shadow-lg shadow-primary/20"
        >
          <Printer className="h-5 w-5" />
          <span className="text-xs font-semibold">Nova etiqueta</span>
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => onQuickAction("labels")}
          className="h-auto py-4 flex-col gap-1.5"
        >
          <Package className="h-5 w-5" />
          <span className="text-xs font-semibold">Ver etiquetas</span>
        </Button>
      </div>

      {/* Resumo do dia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={PackagePlus} label="Recebimentos hoje" value={summary.receipts} tone="emerald" />
        <SummaryCard icon={Printer}     label="Etiquetas emitidas" value={summary.issued} tone="primary" />
        <SummaryCard icon={Trash2}      label="Baixas" value={summary.discharged} tone="orange" />
        <SummaryCard icon={ClipboardCheck} label="Checagens de estoque" value={summary.checks} tone="blue" />
      </div>

      {/* Alertas */}
      {(alerts.expired.length + alerts.today.length + alerts.tomorrow.length + missingProducts.length) > 0 && (
        <Card className="p-4 md:p-5 border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-destructive">Requer atenção</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {alerts.expired.length > 0 && <AlertPill n={alerts.expired.length} label="vencidas" tone="destructive" />}
            {alerts.today.length > 0    && <AlertPill n={alerts.today.length}    label="vencem hoje" tone="orange" />}
            {alerts.tomorrow.length > 0 && <AlertPill n={alerts.tomorrow.length} label="vencem amanhã" tone="amber" />}
            {missingProducts.length > 0 && <AlertPill n={missingProducts.length} label="em falta" tone="destructive" />}
          </div>
        </Card>
      )}

    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  const map: Record<string, string> = {
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    primary: "text-primary bg-primary/10 border-primary/20",
    orange: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center", map[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1 truncate">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function AlertPill({ n, label, tone }: { n: number; label: string; tone: "destructive" | "orange" | "amber" }) {
  const map: Record<string, string> = {
    destructive: "text-destructive",
    orange: "text-orange-500",
    amber: "text-amber-500",
  };
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn("text-2xl font-bold", map[tone])}>{n}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
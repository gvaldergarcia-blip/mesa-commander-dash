import { Card } from "@/components/ui/card";
import { AlertTriangle, Clock, CalendarDays, Tag, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { LabelStats } from "@/lib/labels/utils";

interface Props {
  stats: LabelStats;
  productCount: number;
  activeFilter: string | null;
  onSelect: (filter: string | null) => void;
}

export function LabelStatsCards({ stats, productCount, activeFilter, onSelect }: Props) {
  const items = [
    { key: "expired", label: "Vencidos", value: stats.expired, icon: AlertTriangle, accent: "bg-destructive/15 text-destructive border-destructive/30" },
    { key: "today", label: "Vencem Hoje", value: stats.today, icon: Clock, accent: "bg-warning/15 text-warning border-warning/30" },
    { key: "tomorrow", label: "Vencem Amanhã", value: stats.tomorrow, icon: CalendarDays, accent: "bg-accent/15 text-accent border-accent/30" },
    { key: "month", label: "Etiquetas do Mês", value: stats.monthTotal, icon: Tag, accent: "bg-muted/40 text-foreground border-border/50" },
    { key: "products", label: "Produtos Cadastrados", value: productCount, icon: Package, accent: "bg-muted/40 text-foreground border-border/50" },
  ] as const;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        const active = activeFilter === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onSelect(active ? null : it.key)}
            className={cn(
              "text-left transition-all",
              "rounded-2xl border p-4 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              it.accent,
              active && "ring-2 ring-primary shadow-lg shadow-primary/20"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-3xl font-bold leading-none">{it.value}</div>
            <div className="text-[11px] uppercase tracking-widest mt-2 font-semibold opacity-80">{it.label}</div>
          </button>
        );
      })}
    </div>
  );
}
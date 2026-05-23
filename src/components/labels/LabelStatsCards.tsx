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
    {
      key: "expired", label: "Vencidos", value: stats.expired, icon: AlertTriangle,
      bg: "bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-rose-500/5",
      ring: "border-rose-500/30 hover:border-rose-400/60",
      iconBox: "bg-rose-500/20 text-rose-400",
      number: "text-rose-300",
    },
    {
      key: "today", label: "Vencem Hoje", value: stats.today, icon: Clock,
      bg: "bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-amber-500/5",
      ring: "border-amber-500/30 hover:border-amber-400/60",
      iconBox: "bg-amber-500/20 text-amber-400",
      number: "text-amber-300",
    },
    {
      key: "tomorrow", label: "Vencem Amanhã", value: stats.tomorrow, icon: CalendarDays,
      bg: "bg-gradient-to-br from-sky-500/20 via-sky-500/10 to-sky-500/5",
      ring: "border-sky-500/30 hover:border-sky-400/60",
      iconBox: "bg-sky-500/20 text-sky-400",
      number: "text-sky-300",
    },
    {
      key: "month", label: "Etiquetas do Mês", value: stats.monthTotal, icon: Tag,
      bg: "bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-violet-500/5",
      ring: "border-violet-500/30 hover:border-violet-400/60",
      iconBox: "bg-violet-500/20 text-violet-400",
      number: "text-violet-300",
    },
    {
      key: "products", label: "Produtos Cadastrados", value: productCount, icon: Package,
      bg: "bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-emerald-500/5",
      ring: "border-emerald-500/30 hover:border-emerald-400/60",
      iconBox: "bg-emerald-500/20 text-emerald-400",
      number: "text-emerald-300",
    },
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
              "group relative text-left transition-all overflow-hidden",
              "rounded-2xl border backdrop-blur-sm p-5 hover:scale-[1.02] hover:-translate-y-0.5",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              it.bg, it.ring,
              active && "ring-2 ring-primary shadow-xl shadow-primary/30 scale-[1.02]"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted-foreground/80">
                {it.label}
              </div>
              <div className={cn("p-2 rounded-xl", it.iconBox)}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className={cn("text-4xl font-extrabold leading-none tabular-nums", it.number)}>
              {it.value}
            </div>
            <div className="absolute -bottom-6 -right-6 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity">
              <Icon className="h-24 w-24" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
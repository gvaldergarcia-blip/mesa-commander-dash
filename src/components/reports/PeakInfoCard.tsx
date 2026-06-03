import { Clock, Calendar, XCircle, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PeakInfoCardProps {
  peakHour: string;
  peakDay: string;
  totalServed: number;
  totalCanceled: number;
}

function MetricTile({
  value,
  label,
  caption,
  icon: Icon,
  tone,
}: {
  value: string | number;
  label: string;
  caption: string;
  icon: typeof Clock;
  tone: "success" | "destructive";
}) {
  const toneMap = {
    success: {
      ring: "hover:border-success/60 hover:shadow-[0_18px_40px_-22px_hsl(var(--success)/0.7)]",
      bgIcon: "bg-success/15 text-success ring-1 ring-success/30",
      number: "text-success",
    },
    destructive: {
      ring: "hover:border-destructive/60 hover:shadow-[0_18px_40px_-22px_hsl(var(--destructive)/0.7)]",
      bgIcon: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
      number: "text-destructive",
    },
  } as const;
  const t = toneMap[tone];
  return (
    <div className={cn(
      "group relative rounded-2xl border border-border bg-card p-5 md:p-6 transition-all duration-300",
      t.ring
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] font-light text-muted-foreground">{label}</p>
          <p className={cn("mt-3 metric-display text-5xl md:text-6xl animate-fade-in", t.number)}>{value}</p>
          <p className="mt-2 text-[11px] font-light text-muted-foreground/80">{caption}</p>
        </div>
        <div className={cn("h-14 w-14 shrink-0 rounded-full flex items-center justify-center", t.bgIcon)}>
          <Icon className="h-7 w-7" />
        </div>
      </div>
    </div>
  );
}

function InsightTile({
  value,
  label,
  caption,
  icon: Icon,
}: {
  value: string;
  label: string;
  caption: string;
  icon: typeof Clock;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl p-5 md:p-6 border transition-all duration-300",
        "border-primary/30 hover:border-primary/60",
        "bg-gradient-to-br from-primary/15 via-primary/5 to-transparent",
        "hover:shadow-[0_22px_50px_-22px_hsl(var(--primary)/0.65)]"
      )}
    >
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] font-medium text-primary/80">
            <Sparkles className="h-3 w-3" />
            Insight
          </div>
          <p className="mt-2 text-[11px] uppercase tracking-[0.14em] font-light text-muted-foreground">{label}</p>
          <p className="mt-2 metric-display text-5xl md:text-6xl text-foreground animate-fade-in truncate">{value}</p>
          <p className="mt-2 text-[11px] font-light text-muted-foreground/80">{caption}</p>
        </div>
        <div className="h-14 w-14 shrink-0 rounded-full flex items-center justify-center bg-primary/20 text-primary ring-1 ring-primary/40">
          <Icon className="h-7 w-7" />
        </div>
      </div>
    </div>
  );
}

export function PeakInfoCard({ peakHour, peakDay, totalServed, totalCanceled }: PeakInfoCardProps) {
  const formattedPeakDay = peakDay && peakDay !== '-'
    ? peakDay.charAt(0).toUpperCase() + peakDay.slice(1)
    : 'Aguardando';
  const peakHourValue = peakHour && peakHour !== '-' ? peakHour : 'Aguardando';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
      <MetricTile value={totalServed} label="Total Atendidos" caption="Fila + Reservas" icon={CheckCircle2} tone="success" />
      <MetricTile value={totalCanceled} label="Total Cancelados" caption="Fila + Reservas" icon={XCircle} tone="destructive" />
      <InsightTile value={peakHourValue} label="Horário de Pico" caption="Maior volume no período" icon={Clock} />
      <InsightTile value={formattedPeakDay} label="Dia de Pico" caption="Maior movimento" icon={Calendar} />
    </div>
  );
}

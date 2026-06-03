import { Users, TrendingUp, Star, Mail, AlertTriangle, Cake, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CustomerStrategicKPIsProps = {
  activeCustomers: number;
  frequentCustomers: number;
  highValueCustomers: number;
  marketingOptIn: number;
  atRiskCustomers: number;
  recurrentCustomers?: number;
  birthdayThisMonth?: number;
  onFilterClick?: (filter: string) => void;
};

type KPICardProps = {
  title: string;
  value: number;
  subtitle: string;
  icon: typeof Users;
  variant: 'success' | 'primary' | 'accent' | 'info' | 'warning' | 'birthday' | 'recurrent';
  filterKey: string;
  onClick?: (filter: string) => void;
  highlight?: 'danger-pulse' | 'gold' | null;
};

function KPICard({ title, value, subtitle, icon: Icon, variant, filterKey, onClick, highlight }: KPICardProps) {
  const variants = {
    success: "border-success/25 bg-gradient-to-br from-success/[0.04] to-success/[0.09] hover:border-success/60",
    primary: "border-primary/25 bg-gradient-to-br from-primary/[0.04] to-primary/[0.09] hover:border-primary/60",
    accent: "border-accent/25 bg-gradient-to-br from-accent/[0.04] to-accent/[0.09] hover:border-accent/60",
    info: "border-blue-500/25 bg-gradient-to-br from-blue-500/[0.04] to-blue-500/[0.09] hover:border-blue-500/60",
    warning: "border-destructive/30 bg-gradient-to-br from-destructive/[0.05] to-destructive/[0.10] hover:border-destructive/70",
    birthday: "border-pink-500/25 bg-gradient-to-br from-pink-500/[0.04] to-pink-500/[0.10] hover:border-pink-500/60",
    recurrent: "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.04] to-emerald-500/[0.09] hover:border-emerald-500/60",
  };

  const iconVariants = {
    success: "bg-success text-success-foreground shadow-success/30",
    primary: "bg-primary text-primary-foreground shadow-primary/30",
    accent: "bg-accent text-accent-foreground shadow-accent/30",
    info: "bg-blue-500 text-white shadow-blue-500/30",
    warning: "bg-destructive text-destructive-foreground shadow-destructive/30",
    birthday: "bg-pink-500 text-white shadow-pink-500/30",
    recurrent: "bg-emerald-500 text-white shadow-emerald-500/30",
  };

  const isGold = highlight === 'gold' && value > 0;
  const isDangerPulse = highlight === 'danger-pulse' && value > 0;

  return (
    <Card
      className={cn(
        "relative cursor-pointer overflow-hidden border transition-all duration-300 shadow-sm",
        "hover:-translate-y-0.5 hover:shadow-lg",
        variants[variant],
        isGold && "border-amber-400/70 ring-1 ring-amber-400/40 shadow-amber-200/40",
        isDangerPulse && "animate-pulse-ring-danger border-destructive/60",
      )}
      onClick={() => onClick?.(filterKey)}
    >
      <CardContent className="p-5 min-h-[140px] flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-110",
              iconVariants[variant],
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2.4} />
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-5xl font-black tracking-tighter leading-none text-foreground tabular-nums">
            {value}
          </p>
          <p className="text-xs font-light text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CustomerStrategicKPIs({
  activeCustomers,
  frequentCustomers,
  highValueCustomers,
  marketingOptIn,
  atRiskCustomers,
  recurrentCustomers = 0,
  birthdayThisMonth = 0,
  onFilterClick,
}: CustomerStrategicKPIsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 group/grid">
      <KPICard
        title="Ativos"
        value={activeCustomers}
        subtitle="Últimos 30 dias"
        icon={Users}
        variant="success"
        filterKey="active"
        onClick={onFilterClick}
      />
      <KPICard
        title="Recorrentes"
        value={recurrentCustomers}
        subtitle="3+ visitas"
        icon={RefreshCw}
        variant="recurrent"
        filterKey="recurrent"
        onClick={onFilterClick}
      />
      <KPICard
        title="Alto Valor"
        value={highValueCustomers}
        subtitle="VIPs (10+ visitas)"
        icon={Star}
        variant="accent"
        filterKey="vip"
        onClick={onFilterClick}
      />
      <KPICard
        title="Aniversário"
        value={birthdayThisMonth}
        subtitle="Este mês"
        icon={Cake}
        variant="birthday"
        filterKey="birthday"
        onClick={onFilterClick}
        highlight="gold"
      />
      <KPICard
        title="Opt-in"
        value={marketingOptIn}
        subtitle="Aceitam promoções"
        icon={Mail}
        variant="info"
        filterKey="marketing"
        onClick={onFilterClick}
      />
      <KPICard
        title="Frequentes"
        value={frequentCustomers}
        subtitle="3+ visitas recentes"
        icon={TrendingUp}
        variant="primary"
        filterKey="frequent"
        onClick={onFilterClick}
      />
      <KPICard
        title="Em Risco"
        value={atRiskCustomers}
        subtitle="30+ dias sem visita"
        icon={AlertTriangle}
        variant="warning"
        filterKey="inactive"
        onClick={onFilterClick}
        highlight="danger-pulse"
      />
    </div>
  );
}

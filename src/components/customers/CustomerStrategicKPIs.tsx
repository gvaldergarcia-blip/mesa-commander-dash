import { Users, TrendingUp, Star, Mail, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CustomerStrategicKPIsProps = {
  activeCustomers: number;
  frequentCustomers: number;
  highValueCustomers: number;
  marketingOptIn: number;
  atRiskCustomers: number;
  onFilterClick?: (filter: string) => void;
};

type KPICardProps = {
  title: string;
  value: number;
  subtitle: string;
  icon: typeof Users;
  variant: 'success' | 'primary' | 'accent' | 'info' | 'warning';
  filterKey: string;
  onClick?: (filter: string) => void;
};

function KPICard({ title, value, subtitle, icon: Icon, variant, filterKey, onClick }: KPICardProps) {
  const variants = {
    success: "border-success/30 bg-gradient-to-br from-success/5 to-success/10 hover:from-success/10 hover:to-success/15",
    primary: "border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15",
    accent: "border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 hover:from-accent/10 hover:to-accent/15",
    info: "border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10 hover:from-blue-500/10 hover:to-blue-500/15",
    warning: "border-destructive/30 bg-gradient-to-br from-destructive/5 to-destructive/10 hover:from-destructive/10 hover:to-destructive/15",
  };

  const iconVariants = {
    success: "bg-success/20 text-success",
    primary: "bg-primary/20 text-primary",
    accent: "bg-accent/20 text-accent",
    info: "bg-blue-500/20 text-blue-500",
    warning: "bg-destructive/20 text-destructive",
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200 cursor-pointer group",
        variants[variant]
      )}
      onClick={() => onClick?.(filterKey)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn(
            "p-3 rounded-xl transition-transform group-hover:scale-110",
            iconVariants[variant]
          )}>
            <Icon className="h-5 w-5" />
          </div>
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
  onFilterClick,
}: CustomerStrategicKPIsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KPICard
        title="Clientes Ativos"
        value={activeCustomers}
        subtitle="Últimos 30 dias"
        icon={Users}
        variant="success"
        filterKey="active"
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
        title="Alto Valor"
        value={highValueCustomers}
        subtitle="VIPs (10+ visitas)"
        icon={Star}
        variant="accent"
        filterKey="vip"
        onClick={onFilterClick}
      />
      <KPICard
        title="Opt-in Marketing"
        value={marketingOptIn}
        subtitle="Aceitam promoções"
        icon={Mail}
        variant="info"
        filterKey="marketing"
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
      />
    </div>
  );
}

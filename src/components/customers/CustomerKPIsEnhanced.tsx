import { Users, Calendar, Star, Zap, Clock, Mail } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";

type CustomerKPIsEnhancedProps = {
  total: number;
  active: number;
  vip: number;
  newCustomers: number;
  inactive: number;
  marketingOptIn: number;
};

export function CustomerKPIsEnhanced({ 
  total, 
  active, 
  vip, 
  newCustomers, 
  inactive,
  marketingOptIn,
}: CustomerKPIsEnhancedProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard
        title="Total de Clientes"
        value={total}
        icon={Users}
        description="Base total"
      />
      <MetricCard
        title="Clientes Ativos"
        value={active}
        icon={Calendar}
        description="Últimos 30 dias"
        className="border-success/20 bg-success/5"
      />
      <MetricCard
        title="Novos Clientes"
        value={newCustomers}
        icon={Zap}
        description="Últimos 7 dias"
        className="border-primary/20 bg-primary/5"
      />
      <MetricCard
        title="Clientes VIP"
        value={vip}
        icon={Star}
        description="10+ visitas"
        className="border-accent/20 bg-accent/5"
      />
      <MetricCard
        title="Opt-in Marketing"
        value={marketingOptIn}
        icon={Mail}
        description="Aceitam promoções"
        className="border-blue-500/20 bg-blue-500/5"
      />
      <MetricCard
        title="Inativos"
        value={inactive}
        icon={Clock}
        description="Sem visita há 30+ dias"
        className="border-muted-foreground/20 bg-muted/30"
      />
    </div>
  );
}

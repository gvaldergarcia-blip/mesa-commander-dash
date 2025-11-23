import { Users, Calendar, Star, Zap, Clock } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";

type CustomerKPIsProps = {
  total: number;
  active: number;
  vip: number;
  newCustomers: number;
  inactive: number;
};

export function CustomerKPIs({ total, active, vip, newCustomers, inactive }: CustomerKPIsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <MetricCard
        title="Total de Clientes"
        value={total}
        icon={Users}
        description="Base total de clientes"
      />
      <MetricCard
        title="Clientes Ativos"
        value={active}
        icon={Calendar}
        description="Últimos 30 dias"
        className="border-success/20 bg-success/5"
      />
      <MetricCard
        title="Clientes VIP"
        value={vip}
        icon={Star}
        description="10+ visitas concluídas"
        className="border-accent/20 bg-accent/5"
      />
      <MetricCard
        title="Novos Clientes"
        value={newCustomers}
        icon={Zap}
        description="Últimos 7 dias"
        className="border-primary/20 bg-primary/5"
      />
      <MetricCard
        title="Clientes Inativos"
        value={inactive}
        icon={Clock}
        description="Sem visita há 30+ dias"
        className="border-muted-foreground/20 bg-muted/30"
      />
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { Users, Calendar, TrendingUp, Activity, CheckCircle, XCircle, PhoneCall, ArrowUpRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Badge } from "@/components/ui/badge";
import { CouponsCarousel } from "@/components/coupons/CouponsCarousel";
import { SmartCustomerSearch } from "@/components/customers/SmartCustomerSearch";

interface HeroMetric {
  title: string;
  value: string;
  caption: string;
  icon: typeof Users;
}

interface StatusMetric {
  value: number;
  label: string;
  icon: typeof Users;
  variant: "waiting" | "called" | "served" | "canceled";
}

function HeroMetricCard({ title, value, caption, icon: Icon }: HeroMetric) {
  return (
    <div className="metric-card-gradient p-6 md:p-7">
      <div className="relative z-10 flex items-start justify-between">
        <span className="metric-label">{title}</span>
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="relative z-10 mt-6">
        <div className="metric-display text-5xl md:text-6xl text-foreground">{value}</div>
        <p className="mt-3 text-xs font-light text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

function StatusTile({ value, label, icon: Icon, variant }: StatusMetric) {
  const cls = `status-card status-${variant}`;
  return (
    <div className={cls}>
      <Icon className="h-5 w-5 mb-3 opacity-80" />
      <div className="metric-display text-4xl">{value}</div>
      <p className="mt-2 text-[0.7rem] uppercase tracking-[0.12em] font-light opacity-80">{label}</p>
    </div>
  );
}

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative h-20 w-20 mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-soft" />
        <div className="absolute inset-2 rounded-full bg-primary/15 animate-pulse-soft" style={{ animationDelay: "0.4s" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Activity className="h-7 w-7 text-primary" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="orbit-dot block h-1.5 w-1.5 rounded-full bg-primary/70" />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground">Tudo silencioso por aqui</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-[220px]">
        Movimentos de fila e reservas vão aparecer aqui em tempo real.
      </p>
    </div>
  );
}

function QuickAction({
  to,
  title,
  subtitle,
  icon: Icon,
  onNavigate,
}: {
  to: string;
  title: string;
  subtitle: string;
  icon: typeof Users;
  onNavigate: (to: string) => void;
}) {
  return (
    <button type="button" onClick={() => onNavigate(to)} className="quick-action group">
      <div className="relative z-10 flex items-center gap-4">
        <div className="qa-icon p-3 rounded-xl bg-primary/10 border border-primary/20">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground tracking-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
    </button>
  );
}

export default function Index() {
  const { metrics, loading } = useDashboardMetrics();
  const { restaurant, isLoading: loadingRestaurant } = useRestaurant();
  const navigate = useNavigate();

  const weeklyGrowth = "+12%";

  if (loading || loadingRestaurant) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">Carregando métricas...</p>
      </div>
    );
  }

  const hasActivity =
    metrics.groups_in_queue > 0 ||
    metrics.reservations_today > 0 ||
    metrics.served_today > 0 ||
    metrics.called_today > 0;

  const statusTiles: StatusMetric[] = [
    { value: metrics.groups_in_queue, label: "Esperando", icon: Users, variant: "waiting" },
    { value: metrics.called_today, label: "Chamados Hoje", icon: PhoneCall, variant: "called" },
    { value: metrics.served_today, label: "Atendidos Hoje", icon: CheckCircle, variant: "served" },
    { value: metrics.canceled_today, label: "Cancelados Hoje", icon: XCircle, variant: "canceled" },
  ];

  return (
    <div className="p-3 md:p-8 space-y-8 md:space-y-10">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="metric-display text-4xl md:text-5xl text-foreground">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2 font-light">
            <span className="tracking-wide">{restaurant?.name || 'Carregando...'}</span>
            <Badge variant="secondary" className="bg-success/10 text-success border-success/20 font-medium">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success mr-1.5 animate-pulse" />
              Conectado
            </Badge>
          </p>
        </div>
      </header>

      {/* Hero Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7">
        <HeroMetricCard
          title="Pessoas na Fila"
          value={metrics.people_in_queue.toString()}
          caption={`${metrics.groups_in_queue} grupos esperando agora`}
          icon={Users}
        />
        <HeroMetricCard
          title="Reservas Hoje"
          value={metrics.reservations_today.toString()}
          caption="Total confirmado para o dia"
          icon={Calendar}
        />
        <HeroMetricCard
          title="Crescimento Semanal"
          value={weeklyGrowth}
          caption="Comparado à semana anterior"
          icon={TrendingUp}
        />
      </section>

      {/* Busca inteligente de cliente */}
      <SmartCustomerSearch />

      {/* Cupons Ativos */}
      <CouponsCarousel />

      {/* Activity + Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-7">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Activity className="h-4 w-4 text-primary" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasActivity ? (
              <div className="space-y-4">
                {metrics.groups_in_queue > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-warning" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Cliente adicionado à fila</p>
                      <p className="text-xs text-muted-foreground font-light">
                        {metrics.groups_in_queue} grupos aguardando • agora
                      </p>
                    </div>
                  </div>
                )}
                {metrics.reservations_today > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-accent" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Reserva confirmada</p>
                      <p className="text-xs text-muted-foreground font-light">
                        {metrics.reservations_today} reservas hoje
                      </p>
                    </div>
                  </div>
                )}
                {metrics.served_today > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-success" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Cliente sentado</p>
                      <p className="text-xs text-muted-foreground font-light">
                        {metrics.served_today} atendidos hoje
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyActivity />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Sparkles className="h-4 w-4 text-primary" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction
              to="/queue"
              title="Gerenciar Fila"
              subtitle="Adicionar ou atender clientes"
              icon={Users}
              onNavigate={navigate}
            />
            <QuickAction
              to="/reservations"
              title="Ver Reservas"
              subtitle="Confirmar e gerenciar reservas do dia"
              icon={Calendar}
              onNavigate={navigate}
            />
          </CardContent>
        </Card>
      </section>

      {/* Queue Status Overview */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Status da Fila</h2>
            <p className="text-xs text-muted-foreground font-light mt-0.5">Panorama operacional em tempo real</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {statusTiles.map((tile) => (
            <StatusTile key={tile.variant} {...tile} />
          ))}
        </div>
      </section>
    </div>
  );
}

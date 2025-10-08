import { Users, Clock, Calendar, TrendingUp, Activity, CheckCircle, XCircle, PhoneCall } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { CURRENT_RESTAURANT } from "@/config/current-restaurant";
import { Badge } from "@/components/ui/badge";

export default function Index() {
  const { metrics, loading } = useDashboardMetrics();

  // Calculate weekly growth (mock for now - would need historical data)
  const weeklyGrowth = "+12%";

  if (loading) {
    return (
      <div className="p-6">
        <p>Carregando métricas...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Painel de controle - {CURRENT_RESTAURANT.name}
            <Badge variant="secondary" className="bg-success/10 text-success">
              Conectado
            </Badge>
          </p>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pessoas na Fila"
          value={metrics.queueWaiting.toString()}
          description={`${metrics.queueTotalPeople} pessoas esperando`}
          icon={Users}
        />
        <MetricCard
          title="Tempo Médio de Espera"
          value={`${metrics.avgWaitTime} min`}
          description="Baseado em hoje"
          icon={Clock}
        />
        <MetricCard
          title="Reservas Hoje"
          value={metrics.reservationsToday.toString()}
          description={`${metrics.reservationsConfirmed} confirmadas`}
          icon={Calendar}
        />
        <MetricCard
          title="Crescimento Semanal"
          value={weeklyGrowth}
          description="vs semana anterior"
          icon={TrendingUp}
        />
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-success"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Cliente adicionado à fila</p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.queueWaiting} grupos aguardando • agora
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-accent"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Reserva confirmada</p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.reservationsConfirmed} confirmadas hoje • 5 min atrás
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Cliente sentado</p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.queueSeatedToday} atendidos hoje • 10 min atrás
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <a 
                href="/queue"
                className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-accent/10 transition-colors cursor-pointer"
              >
                <Users className="h-6 w-6 mb-2 text-primary" />
                <span className="text-sm font-medium">Gerenciar Fila</span>
              </a>
              <a 
                href="/reservations"
                className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-accent/10 transition-colors cursor-pointer"
              >
                <Calendar className="h-6 w-6 mb-2 text-accent" />
                <span className="text-sm font-medium">Ver Reservas</span>
              </a>
              <a 
                href="/customers"
                className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-accent/10 transition-colors cursor-pointer"
              >
                <Users className="h-6 w-6 mb-2 text-success" />
                <span className="text-sm font-medium">Clientes</span>
              </a>
              <a 
                href="/promotions"
                className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-accent/10 transition-colors cursor-pointer"
              >
                <TrendingUp className="h-6 w-6 mb-2 text-warning" />
                <span className="text-sm font-medium">Promoções</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Status da Fila Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-warning/10 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div className="text-2xl font-bold text-warning">{metrics.queueWaiting}</div>
              <div className="text-sm text-muted-foreground">Aguardando</div>
            </div>

            <div className="text-center p-4 bg-accent/10 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <PhoneCall className="h-5 w-5 text-accent" />
              </div>
              <div className="text-2xl font-bold text-accent">{metrics.queueCalledNow}</div>
              <div className="text-sm text-muted-foreground">Chamados</div>
            </div>

            <div className="text-center p-4 bg-success/10 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div className="text-2xl font-bold text-success">{metrics.queueSeatedToday}</div>
              <div className="text-sm text-muted-foreground">Atendidos Hoje</div>
            </div>

            <div className="text-center p-4 bg-destructive/10 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-2xl font-bold text-destructive">{metrics.queueCanceledToday}</div>
              <div className="text-sm text-muted-foreground">Cancelados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Clock, Users, Calendar, TrendingUp, UserCheck, Megaphone } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { useRestaurants } from "@/hooks/useRestaurants";

// Real-time metrics will be calculated from Supabase data
const mockMetrics = {
  queueSize: 0,
  avgWaitTime: "-- min",
  todayReservations: 0,
  weeklyGrowth: 0
};

const recentActivity = [
  { id: 1, type: "queue", customer: "Maria Silva", action: "Adicionada à fila", time: "há 2 min", party: 4 },
  { id: 2, type: "reservation", customer: "João Santos", action: "Reserva confirmada", time: "há 5 min", party: 2 },
  { id: 3, type: "queue", customer: "Ana Costa", action: "Chamada para mesa", time: "há 8 min", party: 3 },
  { id: 4, type: "promotion", customer: "Sistema", action: "Campanha enviada", time: "há 15 min", details: "50 emails" },
];

export default function Dashboard() {
  const { restaurants, loading } = useRestaurants();
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {loading ? 'Carregando...' : `${restaurants.length} restaurante(s) conectado(s)`}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Hoje
          </Button>
          <Button>
            <TrendingUp className="w-4 h-4 mr-2" />
            Relatório Semanal
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pessoas na Fila"
          value={mockMetrics.queueSize}
          description="Total aguardando"
          icon={Users}
          trend={{ value: 8.2, isPositive: true }}
        />
        <MetricCard
          title="Tempo Médio"
          value={mockMetrics.avgWaitTime}
          description="Tempo de espera atual"
          icon={Clock}
        />
        <MetricCard
          title="Reservas Hoje"
          value={mockMetrics.todayReservations}
          description="Agendamentos do dia"
          icon={Calendar}
          trend={{ value: 12.5, isPositive: true }}
        />
        <MetricCard
          title="Crescimento Semanal"
          value={`+${mockMetrics.weeklyGrowth}%`}
          description="Comparado à semana passada"
          icon={TrendingUp}
          trend={{ value: mockMetrics.weeklyGrowth, isPositive: true }}
        />
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserCheck className="w-5 h-5 mr-2" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'queue' ? 'bg-warning' :
                    activity.type === 'reservation' ? 'bg-success' : 'bg-accent'
                  }`} />
                  <div>
                    <p className="font-medium text-sm">{activity.customer}</p>
                    <p className="text-xs text-muted-foreground">{activity.action}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                  {activity.party && (
                    <p className="text-xs font-medium">{activity.party} pessoas</p>
                  )}
                  {activity.details && (
                    <p className="text-xs font-medium">{activity.details}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Megaphone className="w-5 h-5 mr-2" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Users className="w-4 h-4 mr-2" />
              Adicionar à Fila
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Nova Reserva
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <UserCheck className="w-4 h-4 mr-2" />
              Cadastrar Cliente
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Megaphone className="w-4 h-4 mr-2" />
              Enviar Promoção
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Queue Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Status da Fila Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-warning/10 border border-warning/20">
              <div className="text-2xl font-bold text-warning">8</div>
              <div className="text-sm text-muted-foreground">Aguardando</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="text-2xl font-bold text-accent">2</div>
              <div className="text-sm text-muted-foreground">Chamados</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-success/10 border border-success/20">
              <div className="text-2xl font-bold text-success">15</div>
              <div className="text-sm text-muted-foreground">Atendidos Hoje</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-muted-foreground">2</div>
              <div className="text-sm text-muted-foreground">Cancelados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
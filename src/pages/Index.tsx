import { Users, Calendar, TrendingUp, Activity, CheckCircle, XCircle, PhoneCall } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { CURRENT_RESTAURANT } from "@/config/current-restaurant";
import { Badge } from "@/components/ui/badge";
import { useRestaurants } from "@/hooks/useRestaurants";
import { CouponsCarousel } from "@/components/coupons/CouponsCarousel";
import { Button } from "@/components/ui/button";
import { createTestCoupon } from "@/utils/testCoupon";
import { useToast } from "@/hooks/use-toast";

export default function Index() {
  const { metrics, loading } = useDashboardMetrics();
  const { restaurants, loading: loadingRestaurants } = useRestaurants();
  const { toast } = useToast();
  
  // Get the current restaurant data from Supabase
  const currentRestaurant = restaurants.find(r => r.id === CURRENT_RESTAURANT.id);
  
  console.log('[Dashboard] Restaurants:', restaurants);
  console.log('[Dashboard] Current restaurant:', currentRestaurant);
  console.log('[Dashboard] Looking for ID:', CURRENT_RESTAURANT.id);

  const handleCreateTestCoupon = async () => {
    try {
      await createTestCoupon();
      toast({
        title: 'Cupom de teste criado!',
        description: 'Recarregando página...',
      });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao criar cupom de teste',
        variant: 'destructive',
      });
    }
  };

  // Calculate weekly growth (mock for now - would need historical data)
  const weeklyGrowth = "+12%";

  if (loading || loadingRestaurants) {
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
            Painel de controle - {currentRestaurant?.name || CURRENT_RESTAURANT.name}
            <Badge variant="secondary" className="bg-success/10 text-success">
              Conectado
            </Badge>
          </p>
        </div>
        <Button onClick={handleCreateTestCoupon} variant="outline">
          🧪 Criar Cupom Teste
        </Button>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Pessoas na Fila"
          value={metrics.people_in_queue.toString()}
          description={`${metrics.groups_in_queue} grupos esperando`}
          icon={Users}
        />
        <MetricCard
          title="Reservas Hoje"
          value={metrics.reservations_today.toString()}
          description="Total de reservas"
          icon={Calendar}
        />
        <MetricCard
          title="Crescimento Semanal"
          value={weeklyGrowth}
          description="vs semana anterior"
          icon={TrendingUp}
        />
      </div>

      {/* Cupons Ativos */}
      <CouponsCarousel />

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
                    {metrics.groups_in_queue} grupos aguardando • agora
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-accent"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Reserva confirmada</p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.reservations_today} reservas hoje • 5 min atrás
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Cliente sentado</p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.served_today} atendidos hoje • 10 min atrás
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
          <CardContent className="space-y-3">
            <a href="/queue" className="block">
              <button className="w-full p-4 rounded-lg border border-border hover:bg-accent/10 transition text-left">
                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Gerenciar Fila</p>
                    <p className="text-xs text-muted-foreground">Adicionar ou atender clientes</p>
                  </div>
                </div>
              </button>
            </a>

            <a href="/reservations" className="block">
              <button className="w-full p-4 rounded-lg border border-border hover:bg-accent/10 transition text-left">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium">Ver Reservas</p>
                    <p className="text-xs text-muted-foreground">Confirmar ou gerenciar reservas</p>
                  </div>
                </div>
              </button>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Queue Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Status da Fila</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-warning/10 rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 text-warning" />
              <div className="text-2xl font-bold">{metrics.groups_in_queue}</div>
              <p className="text-xs text-muted-foreground">Esperando</p>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <PhoneCall className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{metrics.called_today}</div>
              <p className="text-xs text-muted-foreground">Chamados Hoje</p>
            </div>
            <div className="text-center p-4 bg-success/10 rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-success" />
              <div className="text-2xl font-bold">{metrics.served_today}</div>
              <p className="text-xs text-muted-foreground">Atendidos Hoje</p>
            </div>
            <div className="text-center p-4 bg-destructive/10 rounded-lg">
              <XCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
              <div className="text-2xl font-bold">{metrics.canceled_today}</div>
              <p className="text-xs text-muted-foreground">Cancelados Hoje</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

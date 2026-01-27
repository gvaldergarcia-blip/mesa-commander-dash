import { useState } from "react";
import { Clock, Users, Calendar, TrendingUp, UserCheck, Megaphone, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useDashboardMetricsReal } from "@/hooks/useDashboardMetricsReal";
import { useQueue } from "@/hooks/useQueue";
import { useReservations } from "@/hooks/useReservations";
import { FEATURE_FLAGS } from "@/config/feature-flags";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

export default function Dashboard() {
  const { restaurants, loading: loadingRestaurants } = useRestaurants();
  const { metrics, recentActivity, loading: loadingMetrics } = useDashboardMetricsReal();
  const { addToQueue } = useQueue();
  const { createReservation } = useReservations();
  const navigate = useNavigate();
  
  const [isQueueDialogOpen, setIsQueueDialogOpen] = useState(false);
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  
  // Queue dialog state
  const [queueName, setQueueName] = useState("");
  const [queueEmail, setQueueEmail] = useState("");
  const [queuePeople, setQueuePeople] = useState("2");
  const [queueNotes, setQueueNotes] = useState("");
  
  // Reservation dialog state
  const [resName, setResName] = useState("");
  const [resEmail, setResEmail] = useState("");
  const [resDate, setResDate] = useState("");
  const [resTime, setResTime] = useState("");
  const [resPeople, setResPeople] = useState("2");
  const [resNotes, setResNotes] = useState("");
  
  const handleAddQueue = async () => {
    if (!queueName || !queueEmail) return;
    
    await addToQueue({
      customer_name: queueName,
      email: queueEmail,
      people: parseInt(queuePeople),
      notes: queueNotes || undefined,
    });
    
    // Reset
    setQueueName("");
    setQueueEmail("");
    setQueuePeople("2");
    setQueueNotes("");
    setIsQueueDialogOpen(false);
  };
  
  const handleAddReservation = async () => {
    if (!resName || !resEmail || !resDate || !resTime) return;
    
    const dateTime = `${resDate}T${resTime}:00`;
    
    await createReservation({
      customer_name: resName,
      customer_email: resEmail,
      starts_at: dateTime,
      people: parseInt(resPeople),
      notes: resNotes || undefined,
    });
    
    // Reset
    setResName("");
    setResEmail("");
    setResDate("");
    setResTime("");
    setResPeople("2");
    setResNotes("");
    setIsReservationDialogOpen(false);
  };
  
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            {loadingRestaurants ? 'Carregando...' : `${restaurants.length} restaurante(s) conectado(s)`}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Hoje
          </Button>
          <Button onClick={() => navigate('/reports')}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Relatório Semanal
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Grupos na Fila"
          value={metrics.groupsInQueue.toString()}
          description="Total aguardando"
          icon={Users}
        />
        <MetricCard
          title="Pessoas na Fila"
          value={metrics.peopleInQueue.toString()}
          description="Total de pessoas"
          icon={Users}
        />
        <MetricCard
          title="Reservas Hoje"
          value={metrics.reservationsToday.toString()}
          description="Agendamentos do dia"
          icon={Calendar}
          trend={{ value: Math.abs(metrics.weeklyGrowth), isPositive: metrics.weeklyGrowth > 0 }}
        />
        <MetricCard
          title="Atendidos Hoje"
          value={metrics.servedToday.toString()}
          description="Clientes atendidos"
          icon={TrendingUp}
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
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma atividade recente
              </p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'queue' ? 'bg-warning' : 'bg-success'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{activity.customer}</p>
                      <p className="text-xs text-muted-foreground">{activity.action}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                    <p className="text-xs font-medium">{activity.party} pessoas</p>
                  </div>
                </div>
              ))
            )}
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
            <Dialog open={isQueueDialogOpen} onOpenChange={setIsQueueDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full justify-start" variant="outline">
                  <Users className="w-4 h-4 mr-2" />
                  Adicionar à Fila
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Cliente à Fila</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input 
                    placeholder="Nome do cliente"
                    value={queueName}
                    onChange={(e) => setQueueName(e.target.value)}
                  />
                  <Input 
                    type="email"
                    placeholder="Email do cliente"
                    value={queueEmail}
                    onChange={(e) => setQueueEmail(e.target.value)}
                  />
                  <Select value={queuePeople} onValueChange={setQueuePeople}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pessoas" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'pessoa' : 'pessoas'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="Observações (opcional)"
                    value={queueNotes}
                    onChange={(e) => setQueueNotes(e.target.value)}
                  />
                  <Button 
                    className="w-full"
                    onClick={handleAddQueue}
                    disabled={!queueName || !queueEmail}
                  >
                    Adicionar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isReservationDialogOpen} onOpenChange={setIsReservationDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full justify-start" variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Nova Reserva
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Reserva</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input 
                    placeholder="Nome do cliente"
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                  />
                  <Input 
                    type="email"
                    placeholder="E-mail do cliente"
                    value={resEmail}
                    onChange={(e) => setResEmail(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input 
                      type="date"
                      value={resDate}
                      onChange={(e) => setResDate(e.target.value)}
                    />
                    <Input 
                      type="time"
                      value={resTime}
                      onChange={(e) => setResTime(e.target.value)}
                    />
                  </div>
                  <Select value={resPeople} onValueChange={setResPeople}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pessoas" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'pessoa' : 'pessoas'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="Observações especiais (opcional)"
                    value={resNotes}
                    onChange={(e) => setResNotes(e.target.value)}
                  />
                  <Button 
                    className="w-full"
                    onClick={handleAddReservation}
                    disabled={!resName || !resEmail || !resDate || !resTime}
                  >
                    Criar Reserva
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => navigate('/customers')}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Cadastrar Cliente
            </Button>
            
            {/* Botão de Promoção - condicionado à feature flag */}
            {FEATURE_FLAGS.CUPONS_ENABLED && (
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate('/promotions')}
              >
                <Megaphone className="w-4 h-4 mr-2" />
                Enviar Promoção
              </Button>
            )}
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
              <div className="text-2xl font-bold text-warning">{metrics.groupsInQueue}</div>
              <div className="text-sm text-muted-foreground">Aguardando</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="text-2xl font-bold text-accent">{metrics.calledToday}</div>
              <div className="text-sm text-muted-foreground">Chamados</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-success/10 border border-success/20">
              <div className="text-2xl font-bold text-success">{metrics.servedToday}</div>
              <div className="text-sm text-muted-foreground">Atendidos Hoje</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-muted-foreground">{metrics.canceledToday}</div>
              <div className="text-sm text-muted-foreground">Cancelados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
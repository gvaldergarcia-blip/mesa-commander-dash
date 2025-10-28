import { useState } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Calendar,
  Mail,
  DollarSign,
  Target,
  Download,
  Link2,
  Share2,
  XCircle,
  UserPlus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useReportsReal } from "@/hooks/useReportsReal";
import { useExportData } from "@/hooks/useExportData";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DailyEvolutionChart } from "@/components/reports/DailyEvolutionChart";
import { StatusDistributionChart } from "@/components/reports/StatusDistributionChart";
import { HourlyDistributionChart } from "@/components/reports/HourlyDistributionChart";

type PeriodType = 'today' | '7days' | '30days' | '90days';
type SourceType = 'all' | 'queue' | 'reservations';

export default function Reports() {
  const [period, setPeriod] = useState<PeriodType>('30days');
  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { metrics, loading } = useReportsReal(period, sourceType);
  const { exportQueueData, exportReservationsData, exportKPIsData } = useExportData();
  const { toast } = useToast();

  const getPeriodDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    
    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === '7days') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === '30days') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === '90days') {
      startDate.setDate(startDate.getDate() - 90);
    }
    
    return { startDate, endDate };
  };

  const handleExport = async (type: 'queue' | 'reservations' | 'kpis') => {
    try {
      const { startDate, endDate } = getPeriodDates();
      
      if (type === 'queue') {
        await exportQueueData(startDate, endDate);
      } else if (type === 'reservations') {
        await exportReservationsData(startDate, endDate);
      } else if (type === 'kpis') {
        await exportKPIsData(startDate, endDate);
      }
      
      toast({
        title: 'Sucesso',
        description: 'Dados exportados com sucesso!',
      });
      
      setExportDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao exportar dados',
        variant: 'destructive',
      });
    }
  };

  const handleShare = (type: 'email' | 'whatsapp') => {
    const { startDate, endDate } = getPeriodDates();
    const message = `Relatório MesaClik - ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`;
    
    if (type === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent('Confira os relatórios anexados.')}`);
    } else if (type === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
    }
    
    setExportDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Erro ao carregar relatórios.</p>
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios & Análises</h1>
          <p className="text-muted-foreground">Insights sobre o desempenho do seu restaurante</p>
        </div>
        <div className="flex space-x-3 flex-wrap">
          <Select value={sourceType} onValueChange={(value) => setSourceType(value as SourceType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="queue">Apenas Fila</SelectItem>
              <SelectItem value="reservations">Apenas Reservas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="90days">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <BarChart3 className="w-4 h-4 mr-2" />
                Exportar Dados
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exportar Dados</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Escolha o que exportar:</h4>
                  <div className="grid gap-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => handleExport('queue')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Dados da Fila (CSV)
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => handleExport('reservations')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Dados de Reservas (CSV)
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => handleExport('kpis')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      KPIs Consolidados (CSV)
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Compartilhar:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => handleShare('email')}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      E-mail
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleShare('whatsapp')}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Tempo Médio de Espera"
          value={`${metrics.avgWaitTime.current} min`}
          description="Tempo na fila"
          icon={Clock}
          trend={{ value: Math.abs(metrics.avgWaitTime.trend), isPositive: metrics.avgWaitTime.trend < 0 }}
        />
        <MetricCard
          title="Taxa de Conversão"
          value={`${metrics.conversionRate.current}%`}
          description="Reservas confirmadas"
          icon={Target}
          trend={{ value: Math.abs(metrics.conversionRate.trend), isPositive: metrics.conversionRate.trend > 0 }}
        />
        <MetricCard
          title="Taxa de No-Show"
          value={`${metrics.noShowRate.current}%`}
          description="Faltas sem aviso"
          icon={XCircle}
          trend={{ value: Math.abs(metrics.noShowRate.trend), isPositive: metrics.noShowRate.trend < 0 }}
        />
        <MetricCard
          title="Taxa de Cancelamento"
          value={`${metrics.cancelRate.current}%`}
          description="Cancelamentos da fila"
          icon={XCircle}
          trend={{ value: Math.abs(metrics.cancelRate.trend), isPositive: metrics.cancelRate.trend < 0 }}
        />
        <MetricCard
          title="Média por Grupo"
          value={metrics.avgPartySize.current.toFixed(1)}
          description="Pessoas por entrada"
          icon={Users}
          trend={{ value: Math.abs(metrics.avgPartySize.trend), isPositive: metrics.avgPartySize.trend > 0 }}
        />
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyEvolutionChart data={metrics.dailyEvolution} />
        <StatusDistributionChart data={metrics.statusDistribution} />
      </div>

      <HourlyDistributionChart data={metrics.hourlyDistribution} />

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Atendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{metrics.totalServed}</div>
                <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Cancelados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{metrics.totalCanceled}</div>
                <p className="text-xs text-muted-foreground mt-1">Fila de espera</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Horário de Pico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{metrics.peakHour}</div>
                <p className="text-xs text-muted-foreground mt-1">Maior movimento</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Dia de Pico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary capitalize">{metrics.peakDay}</div>
                <p className="text-xs text-muted-foreground mt-1">Melhor dia</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Performance da Fila
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-success/10 border border-success/20">
                      <div className="text-2xl font-bold text-success">{metrics.queueEfficiency}%</div>
                      <div className="text-sm text-muted-foreground">Eficiência</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-warning/10 border border-warning/20">
                      <div className="text-2xl font-bold text-warning">{metrics.avgQueueSize}</div>
                      <div className="text-sm text-muted-foreground">Média diária</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Performance de Reservas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.reservationMetrics.map((metric, index) => (
                    <div key={index} className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-success">{metric.confirmed}</div>
                        <div className="text-xs text-muted-foreground">Confirmadas</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-warning">{metric.pending}</div>
                        <div className="text-xs text-muted-foreground">Pendentes</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-destructive">{metric.noShow}</div>
                        <div className="text-xs text-muted-foreground">No-show</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Novos Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6 rounded-lg bg-gradient-to-br from-accent/5 to-primary/5">
                  <div className="text-4xl font-bold text-accent mb-2">{metrics.newCustomers}</div>
                  <div className="text-sm text-muted-foreground">No período selecionado</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Clientes VIP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-6 rounded-lg bg-gradient-to-br from-success/5 to-accent/5">
                  <div className="text-4xl font-bold text-success mb-2">{metrics.vipCustomers}</div>
                  <div className="text-sm text-muted-foreground">Total de clientes VIP (10+ visitas)</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Para visualizar detalhes completos dos clientes, acesse a página "Clientes" no menu lateral.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Métricas de Fila
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.queueMetrics.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <div className="font-medium">{metric.period}</div>
                        <div className="text-sm text-muted-foreground">
                          {metric.totalServed} pessoas atendidas
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{metric.avgWait} min</div>
                        <div className="text-xs text-muted-foreground">
                          Pico: {metric.peaked}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Métricas de Reservas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.reservationMetrics.map((metric, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-2">{metric.period}</div>
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div className="text-center">
                          <div className="text-lg font-bold text-success">{metric.confirmed}</div>
                          <div className="text-xs text-muted-foreground">Confirmadas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-warning">{metric.pending}</div>
                          <div className="text-xs text-muted-foreground">Pendentes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-destructive">{metric.noShow}</div>
                          <div className="text-xs text-muted-foreground">No-show</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-muted-foreground">{metric.canceled}</div>
                          <div className="text-xs text-muted-foreground">Canceladas</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
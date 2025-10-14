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
  Share2
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

type PeriodType = 'today' | '7days' | '30days' | '90days';

export default function Reports() {
  const [period, setPeriod] = useState<PeriodType>('30days');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { metrics, loading } = useReportsReal(period);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios & Análises</h1>
          <p className="text-muted-foreground">Insights sobre o desempenho do seu restaurante</p>
        </div>
        <div className="flex space-x-3">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          icon={Users}
          trend={{ value: Math.abs(metrics.noShowRate.trend), isPositive: metrics.noShowRate.trend < 0 }}
        />
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="queue">Fila de Espera</TabsTrigger>
          <TabsTrigger value="reservations">Reservas</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Tempo de Espera por Período
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
                  <TrendingUp className="w-5 h-5 mr-2" />
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
                      <div className="text-sm text-muted-foreground">Média na fila</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Horário de pico</span>
                      <span className="font-medium">19:00 - 21:00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Menor movimento</span>
                      <span className="font-medium">14:00 - 16:00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Melhor dia</span>
                      <span className="font-medium">Sábado</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Performance de Reservas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.reservationMetrics.map((metric, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium mb-2">{metric.period}</div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-lg font-bold text-success">{metric.confirmed}</div>
                          <div className="text-muted-foreground">Confirmadas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-warning">{metric.pending}</div>
                          <div className="text-muted-foreground">Pendentes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-destructive">{metric.noShow}</div>
                          <div className="text-muted-foreground">No-show</div>
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
                  <Target className="w-5 h-5 mr-2" />
                  Análise de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-6 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5">
                    <div className="text-3xl font-bold text-primary mb-2">85%</div>
                    <div className="text-sm text-muted-foreground">Taxa de conversão geral</div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pendente → Confirmada</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-2 bg-muted rounded-full">
                          <div className="w-[85%] h-2 bg-success rounded-full"></div>
                        </div>
                        <span className="text-sm font-medium">85%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Confirmada → Check-in</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-2 bg-muted rounded-full">
                          <div className="w-[92%] h-2 bg-accent rounded-full"></div>
                        </div>
                        <span className="text-sm font-medium">92%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Check-in → Finalizada</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-2 bg-muted rounded-full">
                          <div className="w-[98%] h-2 bg-primary rounded-full"></div>
                        </div>
                        <span className="text-sm font-medium">98%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Segmentação de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-accent/10 border border-accent/20">
                      <div className="text-2xl font-bold text-accent">{metrics.newCustomers}</div>
                      <div className="text-sm text-muted-foreground">Novos (30 dias)</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-success/10 border border-success/20">
                      <div className="text-2xl font-bold text-success">{metrics.vipCustomers}</div>
                      <div className="text-sm text-muted-foreground">VIPs (10+ visitas)</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Frequência de Visitas</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">1-2 visitas</span>
                        <span className="text-sm font-medium">60%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">3-5 visitas</span>
                        <span className="text-sm font-medium">25%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">6-10 visitas</span>
                        <span className="text-sm font-medium">10%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">10+ visitas</span>
                        <span className="text-sm font-medium">5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Valor do Cliente (LTV)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-6 rounded-lg bg-gradient-to-br from-success/5 to-primary/5">
                    <div className="text-3xl font-bold text-primary mb-2">R$ 340</div>
                    <div className="text-sm text-muted-foreground">LTV médio estimado</div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Por Segmento</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Clientes VIP</span>
                        <span className="text-sm font-medium">R$ 850</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Frequentes (6-10)</span>
                        <span className="text-sm font-medium">R$ 520</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Regulares (3-5)</span>
                        <span className="text-sm font-medium">R$ 280</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Novos (1-2)</span>
                        <span className="text-sm font-medium">R$ 120</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Performance de Marketing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Métricas de email marketing serão implementadas quando houver campanhas ativas.</p>
                <p className="mt-2 text-sm">Use a página "Promoções" para criar e gerenciar campanhas.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
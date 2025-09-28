import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Calendar,
  Mail,
  DollarSign,
  Target
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

// Mock data - will be replaced with Supabase queries
const mockMetrics = {
  avgWaitTime: {
    current: 25,
    previous: 30,
    trend: -16.7
  },
  conversionRate: {
    current: 85,
    previous: 78,
    trend: 8.9
  },
  noShowRate: {
    current: 12,
    previous: 18,
    trend: -33.3
  },
  emailEngagement: {
    current: 24,
    previous: 19,
    trend: 26.3
  },
  avgTicket: {
    current: 85.50,
    previous: 78.20,
    trend: 9.3
  }
};

const queueMetrics = [
  { period: "Hoje", avgWait: 25, totalServed: 42, peaked: "19:30" },
  { period: "Ontem", avgWait: 30, totalServed: 38, peaked: "20:00" },
  { period: "7 dias", avgWait: 27, totalServed: 285, peaked: "Sáb 19:30" },
  { period: "30 dias", avgWait: 28, totalServed: 1150, peaked: "Sáb 19:30" }
];

const reservationMetrics = [
  { period: "Esta semana", confirmed: 45, pending: 8, noShow: 3 },
  { period: "Semana passada", confirmed: 42, pending: 5, noShow: 6 },
  { period: "Este mês", confirmed: 180, pending: 25, noShow: 15 },
  { period: "Mês passado", confirmed: 165, pending: 30, noShow: 22 }
];

export default function Reports() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios & Análises</h1>
          <p className="text-muted-foreground">Insights sobre o desempenho do seu restaurante</p>
        </div>
        <div className="flex space-x-3">
          <Select defaultValue="30days">
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
          <Button>
            <BarChart3 className="w-4 h-4 mr-2" />
            Exportar Dados
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Tempo Médio de Espera"
          value={`${mockMetrics.avgWaitTime.current} min`}
          description="Tempo na fila"
          icon={Clock}
          trend={{ value: Math.abs(mockMetrics.avgWaitTime.trend), isPositive: mockMetrics.avgWaitTime.trend > 0 }}
        />
        <MetricCard
          title="Taxa de Conversão"
          value={`${mockMetrics.conversionRate.current}%`}
          description="Reservas confirmadas"
          icon={Target}
          trend={{ value: mockMetrics.conversionRate.trend, isPositive: true }}
        />
        <MetricCard
          title="Taxa de No-Show"
          value={`${mockMetrics.noShowRate.current}%`}
          description="Faltas sem aviso"
          icon={Users}
          trend={{ value: Math.abs(mockMetrics.noShowRate.trend), isPositive: mockMetrics.noShowRate.trend < 0 }}
        />
        <MetricCard
          title="Engajamento Email"
          value={`${mockMetrics.emailEngagement.current}%`}
          description="Taxa de abertura"
          icon={Mail}
          trend={{ value: mockMetrics.emailEngagement.trend, isPositive: true }}
        />
        <MetricCard
          title="Ticket Médio"
          value={`R$ ${mockMetrics.avgTicket.current.toFixed(2)}`}
          description="Por cliente"
          icon={DollarSign}
          trend={{ value: mockMetrics.avgTicket.trend, isPositive: true }}
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
                  {queueMetrics.map((metric, index) => (
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
                      <div className="text-2xl font-bold text-success">94%</div>
                      <div className="text-sm text-muted-foreground">Eficiência</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-warning/10 border border-warning/20">
                      <div className="text-2xl font-bold text-warning">8</div>
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
                  {reservationMetrics.map((metric, index) => (
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
                      <div className="text-2xl font-bold text-accent">45</div>
                      <div className="text-sm text-muted-foreground">Novos (30 dias)</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-success/10 border border-success/20">
                      <div className="text-2xl font-bold text-success">23</div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="w-5 h-5 mr-2" />
                  Performance de Email Marketing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <div className="text-lg font-bold text-primary">156</div>
                      <div className="text-xs text-muted-foreground">Enviados</div>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/10">
                      <div className="text-lg font-bold text-accent">87</div>
                      <div className="text-xs text-muted-foreground">Abertos</div>
                    </div>
                    <div className="p-3 rounded-lg bg-success/10">
                      <div className="text-lg font-bold text-success">23</div>
                      <div className="text-xs text-muted-foreground">Cliques</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Taxa de entrega</span>
                      <span className="text-sm font-medium">98.7%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Taxa de abertura</span>
                      <span className="text-sm font-medium text-accent">55.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Taxa de clique</span>
                      <span className="text-sm font-medium text-success">14.7%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Taxa de conversão</span>
                      <span className="text-sm font-medium text-primary">8.3%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  ROI de Campanhas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-6 rounded-lg bg-gradient-to-br from-success/5 to-accent/5">
                    <div className="text-3xl font-bold text-success mb-2">320%</div>
                    <div className="text-sm text-muted-foreground">ROI médio das campanhas</div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium text-sm mb-1">Happy Hour Especial</div>
                      <div className="flex justify-between text-xs">
                        <span>ROI: 450%</span>
                        <span>Conversões: 12</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="font-medium text-sm mb-1">Volta dos VIPs</div>
                      <div className="flex justify-between text-xs">
                        <span>ROI: 280%</span>
                        <span>Conversões: 8</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
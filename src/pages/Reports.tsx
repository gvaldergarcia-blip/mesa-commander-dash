import { useState } from "react";
import { 
  BarChart3, 
  Clock, 
  Users, 
  Target,
  Download,
  Share2,
  XCircle,
  Mail,
  AlertTriangle,
  HelpCircle,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useReportsReal } from "@/hooks/useReportsReal";
import { useExportData } from "@/hooks/useExportData";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DailyEvolutionChart } from "@/components/reports/DailyEvolutionChart";
import { StatusDistributionChart } from "@/components/reports/StatusDistributionChart";
import { HourlyDistributionChart } from "@/components/reports/HourlyDistributionChart";
import { InsightsCard } from "@/components/reports/InsightsCard";
import { CustomerMetricsCard } from "@/components/reports/CustomerMetricsCard";
import { PeakInfoCard } from "@/components/reports/PeakInfoCard";
import { PerformanceCards } from "@/components/reports/PerformanceCards";

type PeriodType = 'today' | '7days' | '30days' | '90days';
type SourceType = 'all' | 'queue' | 'reservations';

/**
 * DOCUMENTAÇÃO DOS TOOLTIPS
 * Cada KPI tem uma explicação clara de como é calculado
 */
const TOOLTIP_FORMULAS = {
  avgWaitTime: "Como calculamos: Média de (horário atendido − horário de entrada) para clientes com status 'sentado'. Fonte: mesaclik.queue_entries onde seated_at está preenchido.",
  conversionRate: "Como calculamos: (Clientes atendidos ÷ Total de entradas na fila) × 100. Representa a porcentagem de clientes que efetivamente foram atendidos. Fonte: mesaclik.queue_entries.",
  noShowRate: "Como calculamos: (Reservas com status 'no_show' ÷ Reservas finalizadas) × 100. Só aparece se houver marcação de não comparecimento. Fonte: mesaclik.reservations.",
  cancelRate: "Como calculamos: (Cancelamentos ÷ Total de registros) × 100. Inclui fila e reservas. Fonte: mesaclik.queue_entries + mesaclik.reservations.",
  avgPartySize: "Como calculamos: Média do tamanho do grupo (party_size) dos clientes atendidos. Fonte: registros com status 'seated' ou 'completed'.",
};

// Componente de KPI Card Premium
function KPICard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  tooltipText,
  variant = "default",
  hasData = true,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  tooltipText?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  hasData?: boolean;
}) {
  const variantStyles = {
    default: "border-border",
    success: "border-success/30 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
    destructive: "border-destructive/30 bg-destructive/5",
  };

  const iconStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-md ${variantStyles[variant]}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {tooltipText && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p className="text-sm whitespace-pre-wrap">{tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className={`text-2xl font-bold ${hasData ? 'text-foreground' : 'text-muted-foreground'}`}>
              {hasData ? value : '-'}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={`p-2.5 rounded-xl ${iconStyles[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend && hasData && trend.value !== 0 && (
          <div className="flex items-center mt-3 pt-3 border-t border-border/50">
            <span
              className={`text-xs font-medium ${
                trend.isPositive ? "text-success" : "text-destructive"
              }`}
            >
              {trend.isPositive ? "↗" : "↘"} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-muted-foreground ml-1.5">vs. período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState<PeriodType>('30days');
  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { metrics, loading, refetch } = useReportsReal(period, sourceType);
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

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Hoje';
      case '7days': return 'Últimos 7 dias';
      case '30days': return 'Últimos 30 dias';
      case '90days': return 'Últimos 90 dias';
      default: return '';
    }
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-muted-foreground">Erro ao carregar relatórios. Tente novamente mais tarde.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verificar se há dados suficientes
  const hasQueueData = metrics.queueMetrics[0]?.totalServed > 0 || metrics.avgQueueSize > 0;
  const hasReservationData = metrics.reservationMetrics[0]?.confirmed > 0 || metrics.reservationMetrics[0]?.pending > 0;
  const hasAnyData = hasQueueData || hasReservationData;

  return (
    <div className="p-6 space-y-6">
      {/* Header Premium */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Análise completa do desempenho do seu restaurante • {getPeriodLabel()}
            {metrics.lastUpdated && (
              <span className="text-xs ml-2">
                (Atualizado às {metrics.lastUpdated})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={refetch} title="Atualizar dados">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Select value={sourceType} onValueChange={(value) => setSourceType(value as SourceType)}>
            <SelectTrigger className="w-44 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Dados</SelectItem>
              <SelectItem value="queue">Apenas Fila</SelectItem>
              <SelectItem value="reservations">Apenas Reservas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodType)}>
            <SelectTrigger className="w-44 bg-card">
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
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exportar Dados</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Escolha o que exportar:</h4>
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
                      Indicadores Consolidados (CSV)
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Compartilhar:</h4>
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

      {/* Aviso se não houver dados */}
      {!hasAnyData && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-foreground">Sem dados no período selecionado</p>
                <p className="text-sm text-muted-foreground">
                  Adicione entradas na fila ou reservas para visualizar as métricas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards Premium */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Tempo Médio de Espera"
          value={`${metrics.avgWaitTime.current} min`}
          description="Fila → Atendimento"
          icon={Clock}
          trend={{ value: Math.abs(metrics.avgWaitTime.trend), isPositive: metrics.avgWaitTime.trend < 0 }}
          tooltipText={TOOLTIP_FORMULAS.avgWaitTime}
          hasData={metrics.avgWaitTime.current > 0}
        />
        <KPICard
          title="Taxa de Conversão"
          value={`${metrics.conversionRate.current}%`}
          description="Entradas atendidas"
          icon={Target}
          trend={{ value: Math.abs(metrics.conversionRate.trend), isPositive: metrics.conversionRate.trend > 0 }}
          tooltipText={TOOLTIP_FORMULAS.conversionRate}
          variant={metrics.conversionRate.current >= 70 ? "success" : "default"}
          hasData={hasQueueData}
        />
        <KPICard
          title="Não Compareceram"
          value={`${metrics.noShowRate.current}%`}
          description="Reservas sem presença"
          icon={XCircle}
          trend={{ value: Math.abs(metrics.noShowRate.trend), isPositive: metrics.noShowRate.trend < 0 }}
          tooltipText={TOOLTIP_FORMULAS.noShowRate}
          variant={metrics.noShowRate.current > 10 ? "destructive" : "default"}
          hasData={metrics.noShowRate.current > 0 || hasReservationData}
        />
        <KPICard
          title="Taxa de Cancelamento"
          value={`${metrics.cancelRate.current}%`}
          description="Fila + Reservas"
          icon={AlertTriangle}
          trend={{ value: Math.abs(metrics.cancelRate.trend), isPositive: metrics.cancelRate.trend < 0 }}
          tooltipText={TOOLTIP_FORMULAS.cancelRate}
          variant={metrics.cancelRate.current > 20 ? "warning" : "default"}
          hasData={hasAnyData}
        />
        <KPICard
          title="Média por Grupo"
          value={metrics.avgPartySize.current.toFixed(1)}
          description="Pessoas por mesa"
          icon={Users}
          trend={{ value: Math.abs(metrics.avgPartySize.trend), isPositive: metrics.avgPartySize.trend > 0 }}
          tooltipText={TOOLTIP_FORMULAS.avgPartySize}
          hasData={metrics.avgPartySize.current > 0}
        />
      </div>

      {/* Resumo Rápido - Total Atendidos, Cancelados, Horário e Dia de Pico */}
      <PeakInfoCard
        peakHour={metrics.peakHour}
        peakDay={metrics.peakDay}
        totalServed={metrics.totalServed}
        totalCanceled={metrics.totalCanceled}
      />

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyEvolutionChart data={metrics?.dailyEvolution} />
        <StatusDistributionChart data={metrics?.statusDistribution} />
      </div>

      {/* Distribuição por Horário */}
      <HourlyDistributionChart data={metrics?.hourlyDistribution} />

      {/* Insights e Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsCard
          peakHour={metrics.peakHour}
          peakDay={metrics.peakDay}
          vipCustomers={metrics.vipCustomers}
          totalServed={metrics.totalServed}
          avgWaitTime={metrics.avgWaitTime.current}
          conversionRate={metrics.conversionRate.current}
          totalCanceled={metrics.totalCanceled}
          noShowRate={metrics.noShowRate.current}
          previousAvgWait={metrics.avgWaitTime.previous}
          previousConversionRate={metrics.conversionRate.previous}
        />
        <CustomerMetricsCard
          newCustomers={metrics.newCustomers}
          vipCustomers={metrics.vipCustomers}
        />
      </div>

      {/* Performance Cards */}
      <PerformanceCards
        queueEfficiency={metrics.queueEfficiency}
        avgQueueSize={metrics.avgQueueSize}
        reservationMetrics={metrics.reservationMetrics}
      />
    </div>
  );
}

import { useState } from "react";
import { 
  BarChart3, 
  Clock, 
  Users, 
  Target,
  Download,
  Share2,
  Mail,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  CalendarCheck
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportsReal } from "@/hooks/useReportsReal";
import { useExportData } from "@/hooks/useExportData";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

// Componentes de gráfico
import { DailyEvolutionChart } from "@/components/reports/DailyEvolutionChart";
import { InsightsCard } from "@/components/reports/InsightsCard";
import { CustomerMetricsCard } from "@/components/reports/CustomerMetricsCard";
import { PeakInfoCard } from "@/components/reports/PeakInfoCard";
import { QueueStatusChart } from "@/components/reports/QueueStatusChart";
import { ReservationStatusChart } from "@/components/reports/ReservationStatusChart";
import { QueueHourlyChart } from "@/components/reports/QueueHourlyChart";
import { QueuePerformanceCard } from "@/components/reports/QueuePerformanceCard";
import { ReservationPerformanceCard } from "@/components/reports/ReservationPerformanceCard";

type PeriodType = 'today' | '7days' | '30days' | '90days';
type SourceType = 'all' | 'queue' | 'reservations';

/**
 * TOOLTIPS COM FÓRMULAS REAIS
 */
const TOOLTIP_FORMULAS = {
  avgWaitTime: "Média de (seated_at − created_at) para entradas com status 'seated'. APENAS fila.",
  conversionRate: "(Atendidos ÷ Total entradas na fila) × 100. Taxa de clientes que foram efetivamente atendidos.",
  noShowRate: "(No-shows ÷ Reservas finalizadas) × 100. APENAS reservas com status 'no_show'.",
  avgPartySize: "Média de pessoas por grupo (party_size) dos atendidos.",
};

function ReportsContent() {
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

  const buildReportSummary = () => {
    const { startDate, endDate } = getPeriodDates();
    const periodStr = `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`;
    
    let summary = `📊 *Relatório MesaClik*\n`;
    summary += `📅 Período: ${periodStr}\n\n`;
    
    // Resumo geral
    summary += `*RESUMO GERAL*\n`;
    summary += `━━━━━━━━━━━━━━━\n`;
    summary += `👥 Total Atendidos: ${metrics?.totalServed || 0}\n`;
    summary += `❌ Total Cancelados: ${metrics?.totalCanceled || 0}\n`;
    if (metrics?.peakHour) summary += `🕐 Horário de Pico: ${metrics.peakHour}\n`;
    if (metrics?.peakDay) summary += `📆 Dia de Maior Movimento: ${metrics.peakDay}\n`;
    summary += `\n`;
    
    // Métricas de Fila
    if (metrics?.queue.hasData) {
      summary += `*FILA*\n`;
      summary += `━━━━━━━━━━━━━━━\n`;
      summary += `⏱️ Tempo Médio: ${metrics.queue.avgWaitTime} min\n`;
      summary += `✅ Taxa de Conversão: ${metrics.queue.conversionRate}%\n`;
      summary += `👤 Total na Fila: ${metrics.queue.totalEntries}\n`;
      summary += `✔️ Atendidos: ${metrics.queue.seated}\n`;
      summary += `🚫 Cancelados: ${metrics.queue.canceled}\n`;
      summary += `\n`;
    }
    
    // Métricas de Reservas
    if (metrics?.reservations.hasData) {
      summary += `*RESERVAS*\n`;
      summary += `━━━━━━━━━━━━━━━\n`;
      summary += `📋 Total: ${metrics.reservations.totalReservations}\n`;
      summary += `✅ Concluídas: ${metrics.reservations.completed}\n`;
      summary += `📌 Confirmadas: ${metrics.reservations.confirmed}\n`;
      summary += `🚫 Canceladas: ${metrics.reservations.canceled}\n`;
      summary += `⚠️ No-Show: ${metrics.reservations.noShow} (${metrics.reservations.noShowRate}%)\n`;
      summary += `\n`;
    }
    
    // Média geral
    if (metrics?.avgPartySize && metrics.avgPartySize > 0) {
      summary += `👥 Média de Pessoas por Grupo: ${metrics.avgPartySize.toFixed(1)}\n`;
    }
    
    summary += `\n_Gerado pelo MesaClik_`;
    
    return summary;
  };

  const handleShare = (type: 'email' | 'whatsapp') => {
    const { startDate, endDate } = getPeriodDates();
    const periodStr = `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`;
    const summary = buildReportSummary();
    
    if (type === 'email') {
      const subject = `Relatório MesaClik - ${periodStr}`;
      const body = summary.replace(/\*/g, '').replace(/━/g, '-');
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else if (type === 'whatsapp') {
      // Usar api.whatsapp.com que funciona universalmente em desktop e mobile
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summary)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
    
    setExportDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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

  const hasQueueData = metrics.queue.hasData;
  const hasReservationData = metrics.reservations.hasData;
  const hasAnyData = hasQueueData || hasReservationData;

  return (
    <div className="p-6 space-y-6">
      {/* Header Premium */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Análise completa do desempenho • {getPeriodLabel()}
            {metrics.lastUpdated && (
              <span className="text-xs ml-2">(Atualizado às {metrics.lastUpdated})</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={refetch} title="Atualizar dados">
            <RefreshCw className="w-4 h-4" />
          </Button>
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
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleExport('queue')}>
                      <Download className="w-4 h-4 mr-2" />
                      Dados da Fila (CSV)
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleExport('reservations')}>
                      <Download className="w-4 h-4 mr-2" />
                      Dados de Reservas (CSV)
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => handleExport('kpis')}>
                      <Download className="w-4 h-4 mr-2" />
                      Indicadores Consolidados (CSV)
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Compartilhar:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => handleShare('email')}>
                      <Mail className="w-4 h-4 mr-2" />
                      E-mail
                    </Button>
                    <Button variant="outline" onClick={() => handleShare('whatsapp')}>
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

      {/* Resumo Rápido - Totais e Picos */}
      <PeakInfoCard
        peakHour={metrics.peakHour}
        peakDay={metrics.peakDay}
        totalServed={metrics.totalServed}
        totalCanceled={metrics.totalCanceled}
      />

      {/* ============================================ */}
      {/* SEÇÕES SEPARADAS: FILA vs RESERVA */}
      {/* ============================================ */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            <Users className="w-4 h-4" />
            Fila
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2">
            <CalendarCheck className="w-4 h-4" />
            Reservas
          </TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* TAB: VISÃO GERAL */}
        {/* ============================================ */}
        <TabsContent value="all" className="space-y-6">
          {/* KPIs Combinados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tempo Médio (FILA) */}
            <Card className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-muted-foreground">Tempo Médio Fila</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm">
                            <p className="text-sm">{TOOLTIP_FORMULAS.avgWaitTime}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className={`text-2xl font-bold ${hasQueueData ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {hasQueueData && metrics.queue.avgWaitTime > 0 ? `${metrics.queue.avgWaitTime} min` : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Entrada → Atendimento</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Taxa Conversão (FILA) */}
            <Card className={`relative overflow-hidden ${metrics.queue.conversionRate >= 70 ? 'border-success/30 bg-success/5' : ''}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-muted-foreground">Conversão Fila</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm">
                            <p className="text-sm">{TOOLTIP_FORMULAS.conversionRate}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className={`text-2xl font-bold ${hasQueueData ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {hasQueueData ? `${metrics.queue.conversionRate}%` : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Atendidos / Total</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${metrics.queue.conversionRate >= 70 ? 'bg-success/10' : 'bg-primary/10'}`}>
                    <Target className={`w-5 h-5 ${metrics.queue.conversionRate >= 70 ? 'text-success' : 'text-primary'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* No-Show (RESERVAS) */}
            <Card className={`relative overflow-hidden ${metrics.reservations.noShowRate > 10 ? 'border-destructive/30 bg-destructive/5' : ''}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-muted-foreground">No-Show Reservas</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm">
                            <p className="text-sm">{TOOLTIP_FORMULAS.noShowRate}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className={`text-2xl font-bold ${hasReservationData ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {hasReservationData ? `${metrics.reservations.noShowRate}%` : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Não compareceram</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${metrics.reservations.noShowRate > 10 ? 'bg-destructive/10' : 'bg-muted'}`}>
                    <AlertTriangle className={`w-5 h-5 ${metrics.reservations.noShowRate > 10 ? 'text-destructive' : 'text-muted-foreground'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Média por Grupo */}
            <Card className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-muted-foreground">Média por Grupo</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm">
                            <p className="text-sm">{TOOLTIP_FORMULAS.avgPartySize}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className={`text-2xl font-bold ${hasAnyData ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {hasAnyData && metrics.avgPartySize > 0 ? metrics.avgPartySize.toFixed(1) : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Pessoas por mesa</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-accent/10">
                    <Users className="w-5 h-5 text-accent-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Evolução Diária + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyEvolutionChart data={metrics.dailyEvolution} />
            <InsightsCard
              peakHour={metrics.peakHour}
              peakDay={metrics.peakDay}
              vipCustomers={metrics.vipCustomers}
              totalServed={metrics.totalServed}
              avgWaitTime={metrics.queue.avgWaitTime}
              conversionRate={metrics.queue.conversionRate}
              totalCanceled={metrics.totalCanceled}
              noShowRate={metrics.reservations.noShowRate}
              previousAvgWait={metrics.queue.avgWaitTimePrevious}
              previousConversionRate={metrics.queue.conversionRatePrevious}
            />
          </div>

          {/* Gráficos de Status SEPARADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QueueStatusChart
              seated={metrics.queue.seated}
              waiting={metrics.queue.waiting + metrics.queue.called}
              canceled={metrics.queue.canceled}
              noShow={metrics.queue.noShow}
            />
            <ReservationStatusChart
              completed={metrics.reservations.completed}
              confirmed={metrics.reservations.confirmed}
              pending={metrics.reservations.pending}
              canceled={metrics.reservations.canceled}
              noShow={metrics.reservations.noShow}
            />
          </div>

          {/* Clientes */}
          <CustomerMetricsCard
            newCustomers={metrics.newCustomers}
            vipCustomers={metrics.vipCustomers}
          />
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: FILA */}
        {/* ============================================ */}
        <TabsContent value="queue" className="space-y-6">
          <QueuePerformanceCard
            avgWaitTime={metrics.queue.avgWaitTime}
            efficiency={metrics.queue.conversionRate}
            totalServed={metrics.queue.seated}
            avgQueueSize={metrics.queue.avgQueueSize}
            hasData={metrics.queue.hasData}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QueueHourlyChart data={metrics.queue.hourlyDistribution} />
            <QueueStatusChart
              seated={metrics.queue.seated}
              waiting={metrics.queue.waiting + metrics.queue.called}
              canceled={metrics.queue.canceled}
              noShow={metrics.queue.noShow}
            />
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: RESERVAS */}
        {/* ============================================ */}
        <TabsContent value="reservations" className="space-y-6">
          <ReservationPerformanceCard
            confirmed={metrics.reservations.confirmed}
            completed={metrics.reservations.completed}
            pending={metrics.reservations.pending}
            noShow={metrics.reservations.noShow}
            canceled={metrics.reservations.canceled}
            hasData={metrics.reservations.hasData}
          />

          <ReservationStatusChart
            completed={metrics.reservations.completed}
            confirmed={metrics.reservations.confirmed}
            pending={metrics.reservations.pending}
            canceled={metrics.reservations.canceled}
            noShow={metrics.reservations.noShow}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Reports() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}

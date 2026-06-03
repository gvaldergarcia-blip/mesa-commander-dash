import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Clock,
  Users,
  Target,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  CalendarCheck,
  Sparkles,
  Activity,
  PieChart as PieChartIcon,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Hourglass,
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
import { cn } from "@/lib/utils";
import { useReportsReal } from "@/hooks/useReportsReal";
import { useExportData } from "@/hooks/useExportData";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useModules } from "@/contexts/ModulesContext";
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
import { QrCodeReportsCard } from "@/components/reports/QrCodeReportsCard";
import { SectionHeader, SectionDivider } from "@/components/reports/SectionHeader";

type PeriodType = 'today' | '7days' | '30days' | '90days';
type SourceType = 'all' | 'queue' | 'reservations';

/**
 * TOOLTIPS COM FÓRMULAS REAIS
 */
const TOOLTIP_FORMULAS = {
  avgWaitTime: "Média de (seated_at − created_at) para entradas com status 'seated'. APENAS fila.",
  conversionRate: "(Atendidos ÷ Total entradas na fila) × 100. Inclui TODOS os status no denominador (waiting, called, seated, canceled, no_show, cleared).",
  noShowRate: "(No-shows ÷ Reservas finalizadas) × 100. Finalizadas = concluídas + no-show + canceladas. APENAS reservas.",
  avgPartySize: "Média de pessoas por grupo (party_size) dos atendidos.",
};

/**
 * Benchmarks aproximados de mercado (segmento gastronômico).
 * Usados apenas como referência visual — não substituem dados próprios.
 */
const BENCHMARKS = {
  avgWaitTime: 18, // min
  conversionRate: 70, // %
  noShowRate: 10, // %
  avgPartySize: 2.6,
};

type BenchmarkTone = "good" | "neutral" | "bad";

function benchmarkTone(value: number, benchmark: number, higherIsBetter: boolean): BenchmarkTone {
  const delta = (value - benchmark) / benchmark;
  if (Math.abs(delta) <= 0.1) return "neutral";
  if (higherIsBetter) return delta > 0 ? "good" : "bad";
  return delta < 0 ? "good" : "bad";
}

function SecondaryMetricCard({
  label,
  value,
  hasData,
  caption,
  benchmarkText,
  tone,
  icon: Icon,
  tooltip,
}: {
  label: string;
  value: string;
  hasData: boolean;
  caption?: string;
  benchmarkText: string;
  tone: BenchmarkTone;
  icon: typeof Clock;
  tooltip?: string;
}) {
  const toneClasses: Record<BenchmarkTone, { num: string; ring: string; iconBg: string }> = {
    good: {
      num: "text-success",
      ring: "hover:border-success/50 hover:shadow-[0_18px_36px_-22px_hsl(var(--success)/0.6)]",
      iconBg: "bg-success/15 text-success ring-1 ring-success/30",
    },
    neutral: {
      num: "text-foreground",
      ring: "hover:border-primary/40 hover:shadow-[0_18px_36px_-22px_hsl(var(--primary)/0.55)]",
      iconBg: "bg-primary/10 text-primary ring-1 ring-primary/25",
    },
    bad: {
      num: "text-warning",
      ring: "hover:border-warning/50 hover:shadow-[0_18px_36px_-22px_hsl(var(--warning)/0.55)]",
      iconBg: "bg-warning/15 text-warning ring-1 ring-warning/30",
    },
  };
  const t = toneClasses[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300",
        t.ring
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] uppercase tracking-[0.14em] font-light text-muted-foreground">{label}</p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {hasData ? (
            <p className={cn("mt-3 metric-display text-4xl md:text-5xl animate-fade-in", t.num)}>{value}</p>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-muted-foreground">
              <Hourglass className="h-4 w-4" />
              <span className="text-sm font-medium">Aguardando dados</span>
            </div>
          )}
          {hasData && caption && (
            <p className="mt-1 text-[11px] font-light text-muted-foreground/80">{caption}</p>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground/60">{benchmarkText}</p>
        </div>
        <div className={cn("h-11 w-11 shrink-0 rounded-full flex items-center justify-center", t.iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

interface Recommendation {
  icon: typeof AlertTriangle;
  problem: string;
  action: string;
  cta: string;
  to: string;
  tone: "warning" | "info" | "success";
}

function RecommendationsBlock({ recommendations }: { recommendations: Recommendation[] }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-5 md:p-6">
      <SectionHeader
        icon={Lightbulb}
        title="O que fazer agora"
        subtitle="Ações priorizadas a partir dos dados do período"
      />
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {recommendations.length === 0 ? (
          <div className="md:col-span-3 text-center py-8 text-sm text-muted-foreground">
            Nada urgente agora — operação saudável no período.
          </div>
        ) : (
          recommendations.map((r, i) => {
            const toneRing =
              r.tone === "warning"
                ? "border-warning/30 hover:border-warning/55"
                : r.tone === "success"
                ? "border-success/30 hover:border-success/55"
                : "border-primary/30 hover:border-primary/55";
            const toneIcon =
              r.tone === "warning"
                ? "bg-warning/15 text-warning"
                : r.tone === "success"
                ? "bg-success/15 text-success"
                : "bg-primary/15 text-primary";
            return (
              <div
                key={i}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-all duration-300 animate-fade-in flex flex-col gap-3",
                  toneRing
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", toneIcon)}>
                    <r.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{r.problem}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">→ {r.action}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="self-end gap-1.5"
                  onClick={() => navigate(r.to)}
                >
                  {r.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ReportsContent() {
  const [period, setPeriod] = useState<PeriodType>('30days');
  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { metrics, loading, refetch } = useReportsReal(period, sourceType);
  const { exportQueueData, exportReservationsData, exportKPIsData } = useExportData();
  const { toast } = useToast();
  const { hasModule } = useModules();

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
      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
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
      <div className="p-4 md:p-6">
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

  // Recomendações geradas a partir dos dados
  const recommendations: Recommendation[] = [];
  if (hasReservationData && metrics.reservations.pending > 0) {
    const totalRes =
      metrics.reservations.pending +
      metrics.reservations.confirmed +
      metrics.reservations.completed +
      metrics.reservations.canceled +
      metrics.reservations.noShow;
    const pct = totalRes > 0 ? Math.round((metrics.reservations.pending / totalRes) * 100) : 0;
    if (pct >= 25) {
      recommendations.push({
        icon: AlertTriangle,
        problem: `${pct}% das reservas ainda pendentes`,
        action: "Confirmar antes que vire no-show",
        cta: "Ir para Reservas",
        to: "/reservations",
        tone: "warning",
      });
    }
  }
  if (hasReservationData && metrics.reservations.noShowRate > 10) {
    recommendations.push({
      icon: AlertTriangle,
      problem: `No-show em ${metrics.reservations.noShowRate}%`,
      action: "Ativar confirmação automática por SMS",
      cta: "Abrir Configurações",
      to: "/settings",
      tone: "warning",
    });
  }
  if (metrics.vipCustomers > 0) {
    recommendations.push({
      icon: Users,
      problem: `${metrics.vipCustomers} clientes VIP identificados`,
      action: "Engajar com promoção dedicada",
      cta: "Ir para Clientes",
      to: "/customers",
      tone: "success",
    });
  }
  if (recommendations.length < 3) {
    recommendations.push({
      icon: Sparkles,
      problem: "Nenhuma campanha esta semana",
      action: "Criar conteúdo no MesaClik Studio",
      cta: "Abrir Studio",
      to: "/marketing/studio",
      tone: "info",
    });
  }
  const top3 = recommendations.slice(0, 3);

  // Helpers de benchmark
  const waitTone = hasQueueData && metrics.queue.avgWaitTime > 0
    ? benchmarkTone(metrics.queue.avgWaitTime, BENCHMARKS.avgWaitTime, false)
    : "neutral";
  const convTone = hasQueueData
    ? benchmarkTone(metrics.queue.conversionRate, BENCHMARKS.conversionRate, true)
    : "neutral";
  const noShowTone = hasReservationData
    ? benchmarkTone(metrics.reservations.noShowRate, BENCHMARKS.noShowRate, false)
    : "neutral";
  const partyTone = hasAnyData && metrics.avgPartySize > 0
    ? benchmarkTone(metrics.avgPartySize, BENCHMARKS.avgPartySize, true)
    : "neutral";

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header Premium */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="metric-display text-4xl md:text-5xl text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-2 font-light">
            Análise completa do desempenho <span className="text-primary font-medium mx-1">•</span> {getPeriodLabel()}
            {metrics.lastUpdated && (
              <span className="text-xs ml-2 text-muted-foreground/70">(Atualizado às {metrics.lastUpdated})</span>
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

      {/* QR Code Metrics */}
      <QrCodeReportsCard
        startDate={getPeriodDates().startDate.toISOString()}
        endDate={getPeriodDates().endDate.toISOString()}
      />

      {/* Resumo Rápido - Totais e Picos */}
      <PeakInfoCard
        peakHour={metrics.peakHour}
        peakDay={metrics.peakDay}
        totalServed={metrics.totalServed}
        totalCanceled={metrics.totalCanceled}
      />

      <SectionDivider />

      {/* ============================================ */}
      {/* SEÇÕES SEPARADAS: FILA vs RESERVA */}
      {/* ============================================ */}
      <Tabs defaultValue={hasModule('fila') ? (hasModule('reserva') ? 'all' : 'queue') : 'reservations'} className="space-y-6">
        <TabsList className="bg-transparent p-0 h-auto gap-1 border-b border-border w-full justify-start rounded-none">
          {hasModule('fila') && hasModule('reserva') && (
            <TabsTrigger
              value="all"
              className="gap-2 px-4 py-3 rounded-none bg-transparent text-muted-foreground font-medium border-b-[3px] border-transparent transition-all duration-200 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:border-primary data-[state=active]:shadow-none hover:text-foreground"
            >
              <BarChart3 className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
          )}
          {hasModule('fila') && (
            <TabsTrigger
              value="queue"
              className="gap-2 px-4 py-3 rounded-none bg-transparent text-muted-foreground font-medium border-b-[3px] border-transparent transition-all duration-200 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:border-primary data-[state=active]:shadow-none hover:text-foreground"
            >
              <Users className="w-4 h-4" />
              Fila
            </TabsTrigger>
          )}
          {hasModule('reserva') && (
            <TabsTrigger
              value="reservations"
              className="gap-2 px-4 py-3 rounded-none bg-transparent text-muted-foreground font-medium border-b-[3px] border-transparent transition-all duration-200 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:font-bold data-[state=active]:border-primary data-[state=active]:shadow-none hover:text-foreground"
            >
              <CalendarCheck className="w-4 h-4" />
              Reservas
            </TabsTrigger>
          )}
        </TabsList>

        {/* ============================================ */}
        {/* TAB: VISÃO GERAL */}
        {/* ============================================ */}
        <TabsContent value="all" className="space-y-8 animate-fade-in">
          {/* KPIs Combinados */}
          <div className="space-y-4">
            <SectionHeader
              icon={Activity}
              title="Métricas operacionais"
              subtitle="Comparadas contra a média de mercado"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SecondaryMetricCard
                label="Tempo Médio Fila"
                value={metrics.queue.avgWaitTime > 0 ? `${metrics.queue.avgWaitTime} min` : '0 min'}
                hasData={hasQueueData && metrics.queue.avgWaitTime > 0}
                caption="Entrada → Atendimento"
                benchmarkText={`Média do setor: ~${BENCHMARKS.avgWaitTime} min`}
                tone={waitTone}
                icon={Clock}
                tooltip={TOOLTIP_FORMULAS.avgWaitTime}
              />
              <SecondaryMetricCard
                label="Conversão Fila"
                value={`${metrics.queue.conversionRate}%`}
                hasData={hasQueueData}
                caption="Atendidos / Total"
                benchmarkText={`Média do setor: ~${BENCHMARKS.conversionRate}%`}
                tone={convTone}
                icon={Target}
                tooltip={TOOLTIP_FORMULAS.conversionRate}
              />
              <SecondaryMetricCard
                label="No-Show Reservas"
                value={`${metrics.reservations.noShowRate}%`}
                hasData={hasReservationData}
                caption="Não compareceram"
                benchmarkText={`Limite saudável: ≤${BENCHMARKS.noShowRate}%`}
                tone={noShowTone}
                icon={AlertTriangle}
                tooltip={TOOLTIP_FORMULAS.noShowRate}
              />
              <SecondaryMetricCard
                label="Média por Grupo"
                value={metrics.avgPartySize > 0 ? metrics.avgPartySize.toFixed(1) : '0'}
                hasData={hasAnyData && metrics.avgPartySize > 0}
                caption="Pessoas por mesa"
                benchmarkText={`Média do setor: ~${BENCHMARKS.avgPartySize}`}
                tone={partyTone}
                icon={Users}
                tooltip={TOOLTIP_FORMULAS.avgPartySize}
              />
            </div>
          </div>

          <SectionDivider />

          {/* Evolução Diária + Inteligência */}
          <div className="space-y-4">
            <SectionHeader
              icon={TrendingUp}
              title="Tendências e inteligência"
              subtitle="Como o período evoluiu e onde focar"
            />
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
          </div>

          <SectionDivider />

          {/* Status SEPARADOS */}
          <div className="space-y-4">
            <SectionHeader
              icon={PieChartIcon}
              title="Distribuição por status"
              subtitle="Composição final do período"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QueueStatusChart
              seated={metrics.queue.seated}
              waiting={metrics.queue.waiting}
              called={metrics.queue.called}
              canceled={metrics.queue.canceled}
              noShow={metrics.queue.noShow}
              cleared={metrics.queue.cleared}
              totalEntries={metrics.queue.totalEntries}
            />
            <ReservationStatusChart
              completed={metrics.reservations.completed}
              confirmed={metrics.reservations.confirmed}
              pending={metrics.reservations.pending}
              canceled={metrics.reservations.canceled}
              noShow={metrics.reservations.noShow}
            />
            </div>
          </div>

          <SectionDivider />

          {/* Clientes */}
          <CustomerMetricsCard
            newCustomers={metrics.newCustomers}
            vipCustomers={metrics.vipCustomers}
          />

          <SectionDivider />

          {/* Recomendações fixas no fim */}
          <RecommendationsBlock recommendations={top3} />
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: FILA */}
        {/* ============================================ */}
        <TabsContent value="queue" className="space-y-6 animate-fade-in">
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
              waiting={metrics.queue.waiting}
              called={metrics.queue.called}
              canceled={metrics.queue.canceled}
              noShow={metrics.queue.noShow}
              cleared={metrics.queue.cleared}
              totalEntries={metrics.queue.totalEntries}
            />
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: RESERVAS */}
        {/* ============================================ */}
        <TabsContent value="reservations" className="space-y-6 animate-fade-in">
          <ReservationPerformanceCard
            confirmed={metrics.reservations.confirmed}
            completed={metrics.reservations.completed}
            pending={metrics.reservations.pending}
            noShow={metrics.reservations.noShow}
            canceled={metrics.reservations.canceled}
            noShowRate={metrics.reservations.noShowRate}
            successRate={metrics.reservations.successRate}
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

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  Calendar,
  AlertTriangle,
  Star,
  Heart,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

type VisitHistory = {
  id: string;
  type: 'queue' | 'reservation';
  date: string;
  party_size: number;
  status: string;
};

interface CustomerBehaviorInsightsProps {
  visits: VisitHistory[];
  totalVisits: number;
  isVip: boolean;
  daysInactive?: number;
}

type InsightType = 'positive' | 'neutral' | 'warning' | 'negative';

interface Insight {
  label: string;
  icon: typeof Star;
  type: InsightType;
  description: string;
}

const typeStyles: Record<InsightType, string> = {
  positive: 'bg-success/15 text-success border-success/30',
  neutral: 'bg-primary/15 text-primary border-primary/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  negative: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function CustomerBehaviorInsights({ 
  visits, 
  totalVisits, 
  isVip,
  daysInactive = 0 
}: CustomerBehaviorInsightsProps) {
  const analysis = useMemo(() => {
    if (visits.length === 0) return null;

    // Frequência de visitas (30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const visitsLast30Days = visits.filter(v => new Date(v.date) >= thirtyDaysAgo).length;

    // Intervalo médio entre visitas
    const sortedVisits = [...visits].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let avgInterval = 0;
    if (sortedVisits.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedVisits.length; i++) {
        const diff = new Date(sortedVisits[i].date).getTime() - new Date(sortedVisits[i-1].date).getTime();
        intervals.push(diff / (1000 * 60 * 60 * 24)); // em dias
      }
      avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    }

    // Taxa de comparecimento
    const completedVisits = visits.filter(v => 
      v.status === 'seated' || v.status === 'completed'
    ).length;
    const showRate = Math.round((completedVisits / visits.length) * 100);

    // Taxa de cancelamento
    const canceledVisits = visits.filter(v => 
      v.status === 'canceled' || v.status === 'no_show'
    ).length;
    const cancelRate = Math.round((canceledVisits / visits.length) * 100);

    // Tamanho médio de grupo
    const avgPartySize = Math.round(
      visits.reduce((sum, v) => sum + v.party_size, 0) / visits.length
    );

    // Horários mais frequentes
    const hourCounts: Record<number, number> = {};
    visits.forEach(v => {
      const hour = new Date(v.date).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0];
    const preferredTime = peakHour 
      ? `${String(peakHour[0]).padStart(2, '0')}:00` 
      : null;

    // Dias da semana mais frequentes
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    visits.forEach(v => {
      const day = dayNames[new Date(v.date).getDay()];
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const peakDay = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])[0];
    const preferredDay = peakDay ? peakDay[0] : null;

    // Canal preferido
    const queueCount = visits.filter(v => v.type === 'queue').length;
    const reservationCount = visits.filter(v => v.type === 'reservation').length;
    const preferredChannel = queueCount >= reservationCount ? 'Fila' : 'Reserva';

    return {
      visitsLast30Days,
      avgInterval,
      showRate,
      cancelRate,
      avgPartySize,
      preferredTime,
      preferredDay,
      preferredChannel,
    };
  }, [visits]);

  const insights = useMemo((): Insight[] => {
    const result: Insight[] = [];

    if (!analysis) return result;

    // VIP
    if (isVip) {
      result.push({
        label: 'Cliente VIP',
        icon: Star,
        type: 'positive',
        description: 'Cliente com 10+ visitas concluídas',
      });
    }

    // Frequência alta (3+ nos últimos 30 dias)
    if (analysis.visitsLast30Days >= 3) {
      result.push({
        label: 'Alta Frequência',
        icon: TrendingUp,
        type: 'positive',
        description: `${analysis.visitsLast30Days} visitas nos últimos 30 dias`,
      });
    }

    // Cliente recorrente (intervalo médio < 14 dias)
    if (analysis.avgInterval > 0 && analysis.avgInterval <= 14) {
      result.push({
        label: 'Cliente Recorrente',
        icon: Heart,
        type: 'positive',
        description: `Visita a cada ~${analysis.avgInterval} dias`,
      });
    }

    // Risco de churn (inativo 21+ dias e tinha boa frequência)
    if (daysInactive >= 21 && totalVisits >= 3) {
      result.push({
        label: 'Risco de Churn',
        icon: AlertTriangle,
        type: 'warning',
        description: `Inativo há ${daysInactive} dias`,
      });
    }

    // Inativo (30+ dias)
    if (daysInactive >= 30) {
      result.push({
        label: 'Cliente Inativo',
        icon: TrendingDown,
        type: 'negative',
        description: 'Sem visitas há mais de 30 dias',
      });
    }

    // Alta taxa de comparecimento (90%+)
    if (analysis.showRate >= 90 && visits.length >= 3) {
      result.push({
        label: 'Sempre Presente',
        icon: Target,
        type: 'positive',
        description: `${analysis.showRate}% de comparecimento`,
      });
    }

    // Baixa conversão (menos de 70%)
    if (analysis.showRate < 70 && visits.length >= 3) {
      result.push({
        label: 'Baixa Conversão',
        icon: AlertTriangle,
        type: 'warning',
        description: `Apenas ${analysis.showRate}% de comparecimento`,
      });
    }

    // Prefere grupos grandes (5+)
    if (analysis.avgPartySize >= 5) {
      result.push({
        label: 'Grupos Grandes',
        icon: Users,
        type: 'neutral',
        description: `Média de ${analysis.avgPartySize} pessoas`,
      });
    }

    return result;
  }, [analysis, isVip, daysInactive, totalVisits, visits.length]);

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Padrões de Comportamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Dados insuficientes para análise
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Insights Badges */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insights.map((insight, index) => (
            <Badge 
              key={index} 
              variant="outline" 
              className={cn("gap-1.5 py-1.5", typeStyles[insight.type])}
              title={insight.description}
            >
              <insight.icon className="w-3.5 h-3.5" />
              {insight.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas de Comportamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Frequência (30d)
              </span>
              <span className="font-semibold">{analysis.visitsLast30Days} visitas</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Intervalo médio
              </span>
              <span className="font-semibold">
                {analysis.avgInterval > 0 ? `${analysis.avgInterval} dias` : 'N/A'}
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                Comparecimento
              </span>
              <span className={cn(
                "font-semibold",
                analysis.showRate >= 80 ? "text-success" : 
                analysis.showRate >= 60 ? "text-warning" : "text-destructive"
              )}>
                {analysis.showRate}%
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Cancelamentos
              </span>
              <span className={cn(
                "font-semibold",
                analysis.cancelRate <= 10 ? "text-success" : 
                analysis.cancelRate <= 30 ? "text-warning" : "text-destructive"
              )}>
                {analysis.cancelRate}%
              </span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Grupo médio
              </span>
              <span className="font-semibold">{analysis.avgPartySize} pessoas</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Canal preferido</span>
              <Badge variant="secondary">{analysis.preferredChannel}</Badge>
            </div>
          </div>
          
          {/* Preferências de horário */}
          {(analysis.preferredTime || analysis.preferredDay) && (
            <div className="pt-3 border-t">
              <p className="text-sm text-muted-foreground mb-2">Preferências</p>
              <div className="flex flex-wrap gap-2">
                {analysis.preferredDay && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    {analysis.preferredDay}
                  </Badge>
                )}
                {analysis.preferredTime && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="w-3 h-3" />
                    {analysis.preferredTime}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

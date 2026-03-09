import { useMemo } from 'react';
import {
  AlertTriangle, Bell, Clock, Calendar, Users,
  TrendingDown, Crown, UserX, ArrowRight, Flame,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RestaurantCustomer } from '@/hooks/useRestaurantCustomers';

type Props = {
  customers: RestaurantCustomer[];
  loading: boolean;
};

type Alert = {
  id: string;
  type: 'churn_risk' | 'vip_missing' | 'inactive_wave' | 'channel_drop';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  count: number;
  icon: typeof AlertTriangle;
};

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = ['10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h', '22h'];

function getHeatColor(value: number, max: number): string {
  if (max === 0) return 'bg-muted';
  const ratio = value / max;
  if (ratio >= 0.8) return 'bg-primary';
  if (ratio >= 0.6) return 'bg-primary/70';
  if (ratio >= 0.4) return 'bg-primary/50';
  if (ratio >= 0.2) return 'bg-primary/30';
  if (ratio > 0) return 'bg-primary/15';
  return 'bg-muted/50';
}

export function AlertsAnalysis({ customers, loading }: Props) {
  const data = useMemo(() => {
    if (!customers.length) return null;

    const now = new Date();

    // === ALERTS ===
    const alerts: Alert[] = [];

    // Churn risk: visited 3+ times but absent 30+ days
    const churnRisk = customers.filter(c => c.total_visits >= 3 && c.days_since_last_visit > 30 && c.days_since_last_visit <= 60);
    if (churnRisk.length > 0) {
      alerts.push({
        id: 'churn_risk',
        type: 'churn_risk',
        severity: churnRisk.length >= 5 ? 'high' : 'medium',
        title: `${churnRisk.length} clientes com risco de churn`,
        description: `Clientes recorrentes que não visitam há 30-60 dias. Envie uma promoção de reengajamento.`,
        count: churnRisk.length,
        icon: TrendingDown,
      });
    }

    // VIP missing: VIP absent 14+ days
    const vipMissing = customers.filter(c => (c.vip || c.total_visits >= 10) && c.days_since_last_visit > 14);
    if (vipMissing.length > 0) {
      alerts.push({
        id: 'vip_missing',
        type: 'vip_missing',
        severity: 'high',
        title: `${vipMissing.length} VIPs ausentes`,
        description: `Clientes VIP não visitam há mais de 14 dias. Ação urgente recomendada.`,
        count: vipMissing.length,
        icon: Crown,
      });
    }

    // Inactive wave: more than 40% inactive
    const inactive = customers.filter(c => c.days_since_last_visit > 30);
    const inactiveRate = Math.round((inactive.length / customers.length) * 100);
    if (inactiveRate > 40) {
      alerts.push({
        id: 'inactive_wave',
        type: 'inactive_wave',
        severity: 'high',
        title: `${inactiveRate}% da base está inativa`,
        description: `${inactive.length} clientes não visitam há mais de 30 dias. Considere uma campanha massiva.`,
        count: inactive.length,
        icon: UserX,
      });
    }

    // === HEATMAP (simulated from created_at dates) ===
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(13).fill(0));
    let maxHeat = 0;
    customers.forEach(c => {
      const d = new Date(c.last_seen_at);
      const day = d.getDay();
      const hour = d.getHours();
      if (hour >= 10 && hour <= 22) {
        heatmap[day][hour - 10]++;
        maxHeat = Math.max(maxHeat, heatmap[day][hour - 10]);
      }
    });

    // === COHORT (retention by month of first visit) ===
    const cohorts: { month: string; total: number; returned: number; rate: number }[] = [];
    const monthMap = new Map<string, { total: number; returned: number }>();

    customers.forEach(c => {
      const created = new Date(c.created_at);
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) monthMap.set(key, { total: 0, returned: 0 });
      const entry = monthMap.get(key)!;
      entry.total++;
      if (c.total_visits >= 2) entry.returned++;
    });

    const sortedMonths = [...monthMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).reverse();
    sortedMonths.forEach(([month, data]) => {
      cohorts.push({
        month: formatMonth(month),
        total: data.total,
        returned: data.returned,
        rate: data.total > 0 ? Math.round((data.returned / data.total) * 100) : 0,
      });
    });

    // === FORECAST (simple 7-day based on recent activity) ===
    const recentActive = customers.filter(c => c.days_since_last_visit <= 7).length;
    const weeklyRate = customers.length > 0 ? recentActive / customers.length : 0;
    const forecast = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dayName = DAYS[d.getDay()];
      // Weekend boost/weekday adjustment
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const base = Math.round(recentActive * (isWeekend ? 1.3 : 0.9) / 7);
      const variance = Math.round(Math.random() * 3 - 1);
      return { day: dayName, date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), estimated: Math.max(1, base + variance) };
    });

    return { alerts, heatmap, maxHeat, cohorts, forecast };
  }, [customers]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  const { alerts, heatmap, maxHeat, cohorts, forecast } = data;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Alertas Automáticos
          </CardTitle>
          <CardDescription>Situações que requerem atenção imediata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum alerta no momento. Tudo sob controle! 🎉</p>
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className={cn(
                "flex items-start gap-3 p-4 rounded-lg border",
                alert.severity === 'high' ? 'bg-destructive/5 border-destructive/30' :
                alert.severity === 'medium' ? 'bg-warning/5 border-warning/30' :
                'bg-muted/50 border-border'
              )}>
                <alert.icon className={cn(
                  "w-5 h-5 mt-0.5 shrink-0",
                  alert.severity === 'high' ? 'text-destructive' :
                  alert.severity === 'medium' ? 'text-warning' :
                  'text-muted-foreground'
                )} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'outline'} className="text-xs">
                      {alert.severity === 'high' ? 'Urgente' : alert.severity === 'medium' ? 'Atenção' : 'Info'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.description}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Mapa de Calor — Movimentação
          </CardTitle>
          <CardDescription>Quando seus clientes mais frequentam (dia × horário)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Hours header */}
              <div className="flex gap-1 mb-1 ml-10">
                {HOURS.map(h => (
                  <div key={h} className="flex-1 text-[10px] text-muted-foreground text-center">{h}</div>
                ))}
              </div>
              {/* Rows */}
              {DAYS.map((day, dayIdx) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <span className="w-9 text-xs text-muted-foreground text-right pr-1 shrink-0">{day}</span>
                  {heatmap[dayIdx].map((val, hourIdx) => (
                    <div
                      key={hourIdx}
                      className={cn("flex-1 h-6 rounded-sm transition-colors", getHeatColor(val, maxHeat))}
                      title={`${day} ${HOURS[hourIdx]}: ${val} clientes`}
                    />
                  ))}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 ml-10">
                <span className="text-[10px] text-muted-foreground">Menos</span>
                {['bg-muted/50', 'bg-primary/15', 'bg-primary/30', 'bg-primary/50', 'bg-primary/70', 'bg-primary'].map(c => (
                  <div key={c} className={cn("w-4 h-4 rounded-sm", c)} />
                ))}
                <span className="text-[10px] text-muted-foreground">Mais</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cohort Retention */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Retenção por Coorte
            </CardTitle>
            <CardDescription>Taxa de retorno por mês de primeiro cadastro</CardDescription>
          </CardHeader>
          <CardContent>
            {cohorts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Dados insuficientes</p>
            ) : (
              <div className="space-y-3">
                {cohorts.map(cohort => (
                  <div key={cohort.month} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{cohort.month}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{cohort.returned}/{cohort.total}</span>
                        <span className={cn(
                          "font-semibold",
                          cohort.rate >= 60 ? 'text-success' : cohort.rate >= 30 ? 'text-warning' : 'text-destructive'
                        )}>
                          {cohort.rate}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          cohort.rate >= 60 ? 'bg-success' : cohort.rate >= 30 ? 'bg-warning' : 'bg-destructive'
                        )}
                        style={{ width: `${cohort.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7-Day Forecast */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Previsão de Demanda (7 dias)
            </CardTitle>
            <CardDescription>Estimativa baseada no padrão recente de visitas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {forecast.map(f => {
                const maxEstimated = Math.max(...forecast.map(x => x.estimated));
                return (
                  <div key={f.date} className="flex items-center gap-3">
                    <div className="w-16 text-sm shrink-0">
                      <span className="font-medium">{f.day}</span>
                      <span className="text-xs text-muted-foreground ml-1">{f.date}</span>
                    </div>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all"
                        style={{ width: `${maxEstimated > 0 ? (f.estimated / maxEstimated) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-8 text-right">{f.estimated}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatMonth(key: string): string {
  const [year, month] = key.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}

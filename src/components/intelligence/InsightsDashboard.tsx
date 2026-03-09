import { useMemo } from 'react';
import {
  Users, TrendingUp, TrendingDown, Crown, AlertTriangle,
  UserCheck, UserX, Sparkles, ArrowUpRight, ArrowDownRight,
  Flame, Clock, Star, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { RestaurantCustomer } from '@/hooks/useRestaurantCustomers';

type Props = {
  customers: RestaurantCustomer[];
  loading: boolean;
};

type Segment = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  customers: RestaurantCustomer[];
  action: string;
};

function computeRFMScore(c: RestaurantCustomer): number {
  const now = new Date();
  const lastSeen = new Date(c.last_seen_at);
  const daysSince = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));

  // Recência (1-5)
  const R = daysSince <= 3 ? 5 : daysSince <= 7 ? 4 : daysSince <= 14 ? 3 : daysSince <= 30 ? 2 : 1;
  // Frequência (1-5)
  const visits = c.total_visits || 0;
  const F = visits >= 15 ? 5 : visits >= 10 ? 4 : visits >= 5 ? 3 : visits >= 2 ? 2 : 1;
  // Valor (1-5) - based on party diversity and channel usage
  const V = (c.total_queue_visits > 0 && c.total_reservation_visits > 0) ? 5 :
    visits >= 10 ? 4 : visits >= 5 ? 3 : visits >= 2 ? 2 : 1;

  return Math.round((R * 0.4 + F * 0.4 + V * 0.2) * 20);
}

function segmentCustomer(c: RestaurantCustomer, score: number): string {
  const daysSince = c.days_since_last_visit;
  const visits = c.total_visits || 0;

  if (score >= 80 && visits >= 10) return 'vip';
  if (score >= 60 && visits >= 5) return 'fiel';
  if (daysSince > 60) return 'perdido';
  if (daysSince > 30 && visits >= 3) return 'em_risco';
  if (daysSince > 30) return 'inativo';
  if (visits <= 2 && daysSince <= 14) return 'novo';
  if (visits >= 3 && score >= 50) return 'promissor';
  return 'novo';
}

function getReturnProbability(c: RestaurantCustomer): number {
  const daysSince = c.days_since_last_visit;
  const visits = c.total_visits || 0;
  let prob = 50;

  if (daysSince <= 3) prob += 25;
  else if (daysSince <= 7) prob += 15;
  else if (daysSince <= 14) prob += 5;
  else if (daysSince > 30) prob -= 15;
  else if (daysSince > 60) prob -= 30;

  if (visits >= 10) prob += 20;
  else if (visits >= 5) prob += 10;
  else if (visits <= 1) prob -= 10;

  if (c.total_reservation_visits > 0) prob += 5;
  if (c.marketing_optin) prob += 5;

  return Math.max(0, Math.min(100, prob));
}

const SEGMENT_CONFIG: Record<string, Omit<Segment, 'customers'>> = {
  vip: { id: 'vip', label: '⭐ VIP (Campeões)', emoji: '⭐', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/30', action: 'Manter engajado com exclusividades' },
  fiel: { id: 'fiel', label: '💚 Fiel', emoji: '💚', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/30', action: 'Incentivar programa de fidelidade' },
  promissor: { id: 'promissor', label: '🚀 Promissor', emoji: '🚀', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/30', action: 'Estimular frequência com promoções' },
  novo: { id: 'novo', label: '🆕 Novo', emoji: '🆕', color: 'text-sky-600', bg: 'bg-sky-500/10 border-sky-500/30', action: 'Boas-vindas e primeira fidelização' },
  em_risco: { id: 'em_risco', label: '⚠️ Em Risco', emoji: '⚠️', color: 'text-orange-600', bg: 'bg-orange-500/10 border-orange-500/30', action: 'Ação urgente de reengajamento' },
  inativo: { id: 'inativo', label: '😴 Inativo', emoji: '😴', color: 'text-muted-foreground', bg: 'bg-muted border-border', action: 'Campanha de reativação com cupom' },
  perdido: { id: 'perdido', label: '❌ Perdido', emoji: '❌', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30', action: 'Winback agressivo ou desconsiderar' },
};

export function InsightsDashboard({ customers, loading }: Props) {
  const analysis = useMemo(() => {
    if (!customers.length) return null;

    const scored = customers.map(c => ({
      customer: c,
      score: computeRFMScore(c),
      segment: '',
      returnProb: getReturnProbability(c),
    }));

    scored.forEach(s => { s.segment = segmentCustomer(s.customer, s.score); });

    // Segments
    const segments: Record<string, RestaurantCustomer[]> = {};
    scored.forEach(s => {
      if (!segments[s.segment]) segments[s.segment] = [];
      segments[s.segment].push(s.customer);
    });

    // Top 10 by score
    const top10 = [...scored].sort((a, b) => b.score - a.score).slice(0, 10);

    // Avg return probability
    const avgReturn = Math.round(scored.reduce((sum, s) => sum + s.returnProb, 0) / scored.length);

    // At risk count
    const atRisk = scored.filter(s => s.segment === 'em_risco' || s.segment === 'perdido').length;

    // Avg score
    const avgScore = Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length);

    // Active rate
    const active30d = customers.filter(c => c.days_since_last_visit <= 30).length;
    const activeRate = Math.round((active30d / customers.length) * 100);

    return { scored, segments, top10, avgReturn, atRisk, avgScore, activeRate, active30d };
  }, [customers]);

  if (loading || !analysis) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const { segments, top10, avgReturn, atRisk, avgScore, activeRate, active30d } = analysis;

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-primary" />
              <Badge variant="outline" className="text-xs">{activeRate}% ativos</Badge>
            </div>
            <p className="text-2xl font-bold">{customers.length}</p>
            <p className="text-xs text-muted-foreground">Total de clientes</p>
            <Progress value={activeRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span className={cn("text-xs font-semibold", avgScore >= 60 ? 'text-success' : avgScore >= 40 ? 'text-warning' : 'text-destructive')}>
                {avgScore >= 60 ? '🟢' : avgScore >= 40 ? '🟡' : '🔴'}
              </span>
            </div>
            <p className="text-2xl font-bold">{avgScore}</p>
            <p className="text-xs text-muted-foreground">Score RFM médio</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <p className="text-2xl font-bold">{avgReturn}%</p>
            <p className="text-xs text-muted-foreground">Prob. retorno média</p>
            <Progress value={avgReturn} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card className={atRisk > 0 ? 'border-destructive/30' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className={cn("w-5 h-5", atRisk > 0 ? 'text-destructive' : 'text-muted-foreground')} />
              {atRisk > 0 && <Badge variant="destructive" className="text-xs">Atenção</Badge>}
            </div>
            <p className="text-2xl font-bold">{atRisk}</p>
            <p className="text-xs text-muted-foreground">Em risco / perdidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Automated Insights */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Insights Automáticos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {active30d > customers.length * 0.7 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
              <ArrowUpRight className="w-4 h-4 text-success mt-0.5 shrink-0" />
              <p className="text-sm"><strong className="text-success">Excelente retenção!</strong> {activeRate}% dos clientes visitaram nos últimos 30 dias.</p>
            </div>
          )}
          {atRisk > 5 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm"><strong className="text-destructive">{atRisk} clientes em risco.</strong> Considere uma campanha de reengajamento urgente.</p>
            </div>
          )}
          {(segments['vip']?.length || 0) > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <Crown className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm"><strong className="text-amber-600">{segments['vip'].length} clientes VIP</strong> representam seu público mais valioso. Mantenha-os engajados!</p>
            </div>
          )}
          {(segments['promissor']?.length || 0) > 3 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <Flame className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm"><strong className="text-blue-600">{segments['promissor'].length} clientes promissores</strong> podem se tornar fiéis com incentivos adequados.</p>
            </div>
          )}
          {customers.filter(c => c.marketing_optin).length < customers.length * 0.3 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
              <ArrowDownRight className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
              <p className="text-sm"><strong className="text-orange-600">Baixo opt-in de marketing</strong> ({customers.filter(c => c.marketing_optin).length}/{customers.length}). Incentive clientes a aceitarem promoções.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Segmentation Visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Segmentação RFM
          </CardTitle>
          <CardDescription>Distribuição automática dos clientes por comportamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Object.entries(SEGMENT_CONFIG).map(([key, config]) => {
              const count = segments[key]?.length || 0;
              const pct = customers.length > 0 ? Math.round((count / customers.length) * 100) : 0;
              return (
                <div key={key} className={cn("p-4 rounded-lg border", config.bg)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{config.emoji}</span>
                    <Badge variant="outline" className="text-xs">{pct}%</Badge>
                  </div>
                  <p className={cn("text-sm font-semibold", config.color)}>{config.label.replace(/^[^\s]+ /, '')}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                  <p className="text-xs text-muted-foreground mt-2 leading-tight">{config.action}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top 10 Ranking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Top 10 Clientes — Score RFM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {top10.map((item, i) => (
              <div key={item.customer.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  i === 0 ? 'bg-amber-500 text-white' :
                  i === 1 ? 'bg-gray-400 text-white' :
                  i === 2 ? 'bg-amber-700 text-white' :
                  'bg-muted text-muted-foreground'
                )}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.customer.customer_name || item.customer.customer_email}</p>
                  <p className="text-xs text-muted-foreground">{item.customer.total_visits} visitas · Última há {item.customer.days_since_last_visit}d</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    "text-lg font-bold",
                    item.score >= 80 ? 'text-success' : item.score >= 60 ? 'text-primary' : item.score >= 40 ? 'text-warning' : 'text-destructive'
                  )}>
                    {item.score}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Score</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

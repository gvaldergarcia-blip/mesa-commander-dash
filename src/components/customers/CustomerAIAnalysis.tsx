import { useState } from 'react';
import {
  Brain, TrendingDown, TrendingUp, AlertTriangle, Target, RefreshCw,
  Sparkles, BadgePercent, Calendar, ArrowRight, Loader2, CheckCircle2,
  XCircle, Minus, ShieldCheck, BarChart3, DollarSign, Gauge, Users,
  TrendingUpIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

type RiskLevel = 'baixo' | 'medio' | 'alto';
type SensibilityLevel = 'baixa' | 'media' | 'alta';

type CustomerAnalysis = {
  resumo: string;
  perfil_comportamento: string;
  risco_perda: { nivel: RiskLevel; justificativa: string };
  sensibilidade_promocao: { nivel: SensibilityLevel; justificativa: string };
  retencao_30d: { nivel: SensibilityLevel; justificativa: string };
  sugestao_acao: { tipo: string; descricao: string; momento_ideal?: string | null };
  score_rfm?: {
    recencia: number;
    frequencia: number;
    valor: number;
    score_composto: number;
    explicacao: string;
  };
  segmento?: {
    id: string;
    label: string;
    cor: string;
    acao_sugerida: string;
  };
  probabilidade_retorno_30d?: {
    score: number;
    fatores_positivos: string[];
    fatores_negativos: string[];
    explicacao: string;
  };
  tendencia?: string;
  metricas_calculadas?: {
    taxa_cancelamento: number;
    frequencia_media_dias: number | null;
    tipo_preferido: string;
  };
  // Backward compat
  risco_churn?: { nivel: RiskLevel; justificativa: string };
  probabilidade_retorno?: { nivel: SensibilityLevel; dias?: number; justificativa: string };
};

type CustomerAIAnalysisProps = {
  customerId: string;
  customerData: {
    name: string;
    vip_status: boolean;
    marketing_opt_in: boolean;
    created_at: string;
    days_since_last_visit?: number;
  };
  metrics: {
    total_visits: number;
    queue_completed: number;
    reservations_completed: number;
    canceled_count?: number;
    no_show_count?: number;
    show_rate?: number;
    avg_party_size?: number;
    preferred_time?: string;
    preferred_channel?: string;
    promotions_sent?: number;
    visits_last_30d?: number;
    visits_last_90d?: number;
    avg_days_between_visits?: number;
    first_visit_date?: string;
  };
  historyData?: {
    queue_count: number;
    reservation_count: number;
  };
};

const riskConfig: Record<RiskLevel, { label: string; color: string; icon: typeof TrendingDown; bg: string }> = {
  baixo: { label: 'Baixo', color: 'text-success', icon: CheckCircle2, bg: 'bg-success/10' },
  medio: { label: 'Médio', color: 'text-warning', icon: Minus, bg: 'bg-warning/10' },
  alto: { label: 'Alto', color: 'text-destructive', icon: AlertTriangle, bg: 'bg-destructive/10' },
};

const sensibilityConfig: Record<SensibilityLevel, { label: string; color: string; bg: string }> = {
  baixa: { label: 'Baixa', color: 'text-muted-foreground', bg: 'bg-muted' },
  media: { label: 'Média', color: 'text-warning', bg: 'bg-warning/10' },
  alta: { label: 'Alta', color: 'text-success', bg: 'bg-success/10' },
};

const actionTypeConfig: Record<string, { label: string; color: string; icon: typeof Target }> = {
  enviar_promocao: { label: 'Enviar Promoção', color: 'text-primary', icon: BadgePercent },
  fidelizar: { label: 'Fidelizar', color: 'text-amber-500', icon: Sparkles },
  recuperar: { label: 'Recuperar', color: 'text-warning', icon: RefreshCw },
  nao_agir: { label: 'Nenhuma Ação', color: 'text-success', icon: ShieldCheck },
  acompanhar: { label: 'Acompanhar', color: 'text-blue-500', icon: Target },
};

const segmentoColorMap: Record<string, string> = {
  dourado: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  verde: 'bg-success/15 text-success border-success/30',
  roxo: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  azul: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  laranja: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  cinza: 'bg-muted text-muted-foreground border-border',
  vermelho: 'bg-destructive/15 text-destructive border-destructive/30',
};

function RFMBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}/5</span>
      </div>
      <Progress value={value * 20} className="h-2" />
    </div>
  );
}

export function CustomerAIAnalysis({ customerId, customerData, metrics, historyData }: CustomerAIAnalysisProps) {
  const { restaurantId } = useRestaurant();
  const [analysis, setAnalysis] = useState<CustomerAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-customer', {
        body: { customer_id: customerId, restaurant_id: restaurantId, customer_data: customerData, metrics, history_data: historyData }
      });
      if (fnError) throw fnError;
      if (data?.error) { setError(data.error); return; }
      if (data?.analysis) { setAnalysis(data.analysis); setHasGenerated(true); }
    } catch (err) {
      console.error('[CustomerAIAnalysis] Error:', err);
      setError('Não foi possível gerar a análise. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (metrics.total_visits === 0 && !loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Brain className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Dados insuficientes para análise de IA.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">O cliente precisa ter pelo menos uma visita registrada.</p>
        </CardContent>
      </Card>
    );
  }

  if (!hasGenerated && !loading && !analysis) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg"><Brain className="w-5 h-5 text-primary" /></div>
            <div>
              <CardTitle className="text-lg">IA de Análise do Cliente</CardTitle>
              <CardDescription className="text-xs">A MesaClik IA analisa o comportamento deste cliente com base no histórico de visitas, filas e reservas.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Button onClick={fetchAnalysis} className="gap-2">
            <Brain className="w-4 h-4" /> Gerar Análise de IA
          </Button>
          <p className="text-xs text-muted-foreground mt-3">Inclui Score RFM, segmentação, probabilidade de retorno e LTV estimado.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pb-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <CardTitle className="text-lg">IA de Análise do Cliente</CardTitle>
          </div>
          <CardDescription>Calculando Score RFM, segmentação e probabilidade de retorno...</CardDescription>
        </CardHeader>
        <CardContent className="py-8">
          <div className="space-y-4">
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
            <div className="h-20 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAnalysis}>
              <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const riscoPerda = analysis.risco_perda || analysis.risco_churn;
  const retencao30d = analysis.retencao_30d || analysis.probabilidade_retorno;
  if (!riscoPerda || !retencao30d) return null;

  const RiskIcon = riskConfig[riscoPerda.nivel]?.icon || Minus;
  const ActionIcon = actionTypeConfig[analysis.sugestao_acao.tipo]?.icon || Target;
  const isNoAction = analysis.sugestao_acao.tipo === 'nao_agir' || analysis.sugestao_acao.tipo === 'acompanhar';

  const rfm = analysis.score_rfm;
  const segmento = analysis.segmento;
  const probRetorno = analysis.probabilidade_retorno_30d;
  const ltv = analysis.ltv_estimado;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg"><Brain className="w-5 h-5 text-primary" /></div>
            <div>
              <CardTitle className="text-lg">IA de Análise do Cliente</CardTitle>
              <CardDescription className="text-xs">Análise estratégica gerada pela MesaClik IA</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {segmento && (
              <Badge variant="outline" className={cn("text-xs font-semibold", segmentoColorMap[segmento.cor] || 'bg-muted')}>
                {segmento.label}
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={fetchAnalysis} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {/* Resumo */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Resumo Inteligente</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.resumo}</p>
            </div>
          </div>
        </div>

        {/* Score RFM + Probabilidade + LTV */}
        {(rfm || probRetorno || ltv) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Score RFM */}
            {rfm && (
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold">Score RFM</p>
                    </div>
                    <span className={cn(
                      "text-2xl font-bold",
                      rfm.score_composto >= 80 ? 'text-success' :
                      rfm.score_composto >= 60 ? 'text-primary' :
                      rfm.score_composto >= 40 ? 'text-warning' : 'text-destructive'
                    )}>
                      {rfm.score_composto}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <RFMBar label="Recência" value={rfm.recencia} />
                    <RFMBar label="Frequência" value={rfm.frequencia} />
                    <RFMBar label="Valor" value={rfm.valor} />
                  </div>
                  <p className="text-xs text-muted-foreground">{rfm.explicacao}</p>
                </CardContent>
              </Card>
            )}

            {/* Probabilidade de Retorno */}
            {probRetorno && (
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold">Retorno (30d)</p>
                    </div>
                    <span className={cn(
                      "text-2xl font-bold",
                      probRetorno.score >= 70 ? 'text-success' :
                      probRetorno.score >= 40 ? 'text-warning' : 'text-destructive'
                    )}>
                      {probRetorno.score}%
                    </span>
                  </div>
                  <Progress value={probRetorno.score} className="h-2" />
                  {probRetorno.fatores_positivos?.length > 0 && (
                    <div className="space-y-1">
                      {probRetorno.fatores_positivos.slice(0, 3).map((f, i) => (
                        <p key={i} className="text-xs text-success flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" /> {f}
                        </p>
                      ))}
                    </div>
                  )}
                  {probRetorno.fatores_negativos?.length > 0 && (
                    <div className="space-y-1">
                      {probRetorno.fatores_negativos.slice(0, 2).map((f, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1">
                          <XCircle className="w-3 h-3 shrink-0" /> {f}
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{probRetorno.explicacao}</p>
                </CardContent>
              </Card>
            )}

            {/* LTV Estimado */}
            {ltv && (
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold">LTV Estimado</p>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      ltv.classificacao === 'alto' ? 'bg-success/10 text-success border-success/30' :
                      ltv.classificacao === 'medio' ? 'bg-warning/10 text-warning border-warning/30' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {ltv.classificacao === 'alto' ? '💎 Alto' : ltv.classificacao === 'medio' ? '📊 Médio' : '📉 Baixo'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Mensal</span>
                      <span className="text-lg font-bold">R$ {ltv.valor_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Anual</span>
                      <span className="text-sm font-semibold text-muted-foreground">R$ {ltv.valor_anual?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{ltv.explicacao}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Segmento do cliente */}
        {segmento && (
          <div className={cn("p-4 rounded-lg border", segmentoColorMap[segmento.cor] || 'bg-muted')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{segmento.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{segmento.acao_sugerida}</p>
              </div>
              {analysis.tendencia && (
                <Badge variant="outline" className={cn(
                  "text-xs gap-1",
                  analysis.tendencia === 'crescendo' ? 'bg-success/10 text-success' :
                  analysis.tendencia === 'diminuindo' ? 'bg-destructive/10 text-destructive' :
                  'bg-muted text-muted-foreground'
                )}>
                  {analysis.tendencia === 'crescendo' ? <TrendingUp className="w-3 h-3" /> :
                   analysis.tendencia === 'diminuindo' ? <TrendingDown className="w-3 h-3" /> : null}
                  {analysis.tendencia === 'crescendo' ? 'Crescendo' : analysis.tendencia === 'diminuindo' ? 'Diminuindo' : 'Estável'}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Perfil de Comportamento */}
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" /> Perfil de Comportamento
          </p>
          <p className="text-sm text-muted-foreground pl-6 leading-relaxed">{analysis.perfil_comportamento}</p>
        </div>

        {/* Métricas calculadas */}
        {analysis.metricas_calculadas && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Taxa Cancelamento</p>
              <p className={cn("text-sm font-semibold", analysis.metricas_calculadas.taxa_cancelamento > 30 ? 'text-destructive' : 'text-foreground')}>
                {analysis.metricas_calculadas.taxa_cancelamento}%
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Freq. Média</p>
              <p className="text-sm font-semibold">
                {analysis.metricas_calculadas.frequencia_media_dias != null ? `${analysis.metricas_calculadas.frequencia_media_dias}d` : 'N/A'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Canal Preferido</p>
              <p className="text-sm font-semibold capitalize">{analysis.metricas_calculadas.tipo_preferido}</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Cards de Risco / Sensibilidade / Retenção */}
        <div className="grid grid-cols-3 gap-3">
          <div className={cn("p-3 rounded-lg text-center", riskConfig[riscoPerda.nivel]?.bg || 'bg-muted')}>
            <RiskIcon className={cn("w-5 h-5 mx-auto mb-1", riskConfig[riscoPerda.nivel]?.color)} />
            <p className="text-xs text-muted-foreground">Risco de Perda</p>
            <p className={cn("text-sm font-semibold", riskConfig[riscoPerda.nivel]?.color)}>
              {riskConfig[riscoPerda.nivel]?.label || riscoPerda.nivel}
            </p>
          </div>
          <div className={cn("p-3 rounded-lg text-center", sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.bg || 'bg-muted')}>
            <BadgePercent className={cn("w-5 h-5 mx-auto mb-1", sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.color)} />
            <p className="text-xs text-muted-foreground">Sensibilidade</p>
            <p className={cn("text-sm font-semibold", sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.color)}>
              {sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.label || analysis.sensibilidade_promocao.nivel}
            </p>
          </div>
          <div className={cn("p-3 rounded-lg text-center", sensibilityConfig[retencao30d.nivel]?.bg || 'bg-muted')}>
            <Calendar className={cn("w-5 h-5 mx-auto mb-1", sensibilityConfig[retencao30d.nivel]?.color)} />
            <p className="text-xs text-muted-foreground">Retenção (30d)</p>
            <p className={cn("text-sm font-semibold", sensibilityConfig[retencao30d.nivel]?.color)}>
              {sensibilityConfig[retencao30d.nivel]?.label || retencao30d.nivel}
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground">
          <p><strong>Risco de Perda:</strong> {riscoPerda.justificativa}</p>
          <p><strong>Promoções:</strong> {analysis.sensibilidade_promocao.justificativa}</p>
          <p><strong>Retenção:</strong> {retencao30d.justificativa}</p>
        </div>

        <Separator />

        {/* Sugestão de Ação */}
        <div className={cn("p-4 rounded-lg border", isNoAction ? "bg-success/5 border-success/20" : "bg-primary/5 border-primary/20")}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-background">
              <ActionIcon className={cn("w-5 h-5", actionTypeConfig[analysis.sugestao_acao.tipo]?.color || 'text-muted-foreground')} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold">Sugestão Inteligente</p>
                <Badge variant="secondary" className={cn("text-xs", isNoAction && "bg-success/10 text-success border-success/30")}>
                  {actionTypeConfig[analysis.sugestao_acao.tipo]?.label || analysis.sugestao_acao.tipo}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{analysis.sugestao_acao.descricao}</p>
              {analysis.sugestao_acao.momento_ideal && (
                <p className="text-xs text-primary mt-2 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> {analysis.sugestao_acao.momento_ideal}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

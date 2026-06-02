import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, AlertTriangle, RefreshCw, Sparkles, BadgePercent, Loader2,
  CheckCircle2, XCircle, Gauge, ChevronDown, ChevronUp, Send, Heart, Megaphone, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

const riskConfig: Record<RiskLevel, { label: string; color: string }> = {
  baixo: { label: 'Baixo', color: 'text-success' },
  medio: { label: 'Médio', color: 'text-warning' },
  alto: { label: 'Alto', color: 'text-destructive' },
};

const sensibilityConfig: Record<SensibilityLevel, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'text-muted-foreground' },
  media: { label: 'Média', color: 'text-warning' },
  alta: { label: 'Alta', color: 'text-success' },
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

/** Texto neutro padrão quando não há dado suficiente para uma métrica */
const INSUFFICIENT = 'Dados insuficientes';

/** Reduz uma frase longa a impacto curto (corta no primeiro ponto/quebra ou 90 chars) */
function shorten(text: string | undefined | null, maxLen = 90): string {
  if (!text) return '';
  const firstSentence = text.split(/[.!?\n]/)[0].trim();
  const base = firstSentence.length >= 12 ? firstSentence : text;
  return base.length > maxLen ? base.slice(0, maxLen - 1).trimEnd() + '…' : base;
}

function RFMBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-light tracking-wide uppercase">{label}</span>
        <span className="font-semibold tabular-nums">{value}/5</span>
      </div>
      <Progress value={value * 20} className="h-1.5" />
    </div>
  );
}

/** Sugestão de ação contextual por segmento */
function segmentAction(segmentoId?: string, segmentoLabel?: string): { label: string; icon: typeof Send } {
  const id = (segmentoId || segmentoLabel || '').toLowerCase();
  if (id.includes('fiel') || id.includes('vip') || id.includes('our')) {
    return { label: 'Enviar reconhecimento', icon: Heart };
  }
  if (id.includes('risco') || id.includes('inativ') || id.includes('perdi')) {
    return { label: 'Criar campanha de reativação', icon: Megaphone };
  }
  if (id.includes('novo') || id.includes('explor')) {
    return { label: 'Enviar boas-vindas', icon: Send };
  }
  if (id.includes('promiss') || id.includes('cresc')) {
    return { label: 'Enviar promoção', icon: BadgePercent };
  }
  return { label: 'Enviar ação', icon: Send };
}

export function CustomerAIAnalysis({ customerId, customerData, metrics, historyData }: CustomerAIAnalysisProps) {
  const { restaurantId } = useRestaurant();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<CustomerAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[CustomerAIAnalysis] Invoking analyze-customer for:', customerId, 'restaurant:', restaurantId);
      const { data, error: fnError } = await supabase.functions.invoke('analyze-customer', {
        body: { customer_id: customerId, restaurant_id: restaurantId, customer_data: customerData, metrics, history_data: historyData }
      });
      console.log('[CustomerAIAnalysis] Response:', { data: data ? 'received' : 'null', error: fnError });
      if (fnError) {
        console.error('[CustomerAIAnalysis] Function error details:', JSON.stringify(fnError));
        throw fnError;
      }
      if (data?.error) { 
        console.error('[CustomerAIAnalysis] Data error:', data.error);
        setError(data.error); 
        return; 
      }
      if (data?.analysis) { setAnalysis(data.analysis); setHasGenerated(true); }
      else {
        console.warn('[CustomerAIAnalysis] No analysis in response:', data);
        setError('Resposta vazia da IA. Tente novamente.');
      }
    } catch (err: any) {
      console.error('[CustomerAIAnalysis] Error:', err);
      const message = err?.message || err?.context?.message || 'Não foi possível gerar a análise. Tente novamente.';
      setError(message.includes('Failed to send a request') ? 'Falha de conexão com a análise de IA. Tente novamente.' : message);
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
          <p className="text-xs text-muted-foreground mt-3">Inclui Score RFM, segmentação e probabilidade de retorno.</p>
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

  const rfm = analysis.score_rfm;
  const segmento = analysis.segmento;
  const probRetorno = analysis.probabilidade_retorno_30d;

  /* --------- HERO: métrica principal gigante (Probabilidade de Retorno 30d) --------- */
  const heroScore = probRetorno?.score;
  const heroAvailable = typeof heroScore === 'number' && heroScore >= 0;
  const heroColorClass = !heroAvailable
    ? 'text-muted-foreground'
    : heroScore >= 70 ? 'text-success'
    : heroScore >= 40 ? 'text-warning'
    : 'text-destructive';
  const heroLabel = !heroAvailable
    ? 'Sem leitura'
    : heroScore >= 70 ? 'Alta chance de retorno'
    : heroScore >= 40 ? 'Retorno incerto'
    : 'Baixa chance de retorno';
  const heroSubtitle = heroAvailable
    ? shorten(probRetorno?.explicacao, 80) || `${heroLabel} nos próximos 30 dias`
    : INSUFFICIENT;

  const SegAction = segmentAction(segmento?.id, segmento?.label);

  const handleSegmentAction = () => {
    navigate(`/marketing/creator?customer_id=${customerId}`);
  };

  return (
    <Card className="overflow-hidden border-border/60">
      {/* HEADER */}
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">Análise de IA</CardTitle>
              <CardDescription className="text-xs font-light">MesaClik IA · perfil estratégico</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchAnalysis} disabled={loading} aria-label="Recalcular">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      {/* HERO */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        <div className="relative px-6 py-8 md:py-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <p className="metric-label">Probabilidade de retorno · 30 dias</p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className={cn('metric-display text-7xl md:text-8xl', heroColorClass)}>
                  {heroAvailable ? heroScore : '—'}
                </span>
                {heroAvailable && <span className="text-2xl font-light text-muted-foreground">%</span>}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{heroLabel}</p>
              <p className="text-xs text-muted-foreground font-light mt-1">{heroSubtitle}</p>
            </div>

            {/* Segmento + ação inline */}
            {segmento ? (
              <div className="flex flex-col items-start md:items-end gap-2 max-w-[260px]">
                <Badge variant="outline" className={cn('text-xs font-semibold', segmentoColorMap[segmento.cor] || 'bg-muted')}>
                  {segmento.label}
                </Badge>
                <p className="text-xs text-muted-foreground font-light text-left md:text-right">
                  {shorten(segmento.acao_sugerida, 70) || INSUFFICIENT}
                </p>
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={handleSegmentAction}>
                  <SegAction.icon className="w-3.5 h-3.5" />
                  {SegAction.label}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{INSUFFICIENT}</p>
            )}
          </div>
        </div>
      </div>

      {/* MÉTRICAS SECUNDÁRIAS (máx 3) */}
      <CardContent className="pt-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* RFM */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="metric-label">Score RFM</span>
            </div>
            {rfm ? (
              <>
                <div className={cn(
                  'metric-display text-3xl',
                  rfm.score_composto >= 80 ? 'text-success' :
                  rfm.score_composto >= 60 ? 'text-primary' :
                  rfm.score_composto >= 40 ? 'text-warning' : 'text-destructive'
                )}>
                  {rfm.score_composto}
                </div>
                <p className="text-xs text-muted-foreground font-light mt-2 line-clamp-1">
                  {shorten(rfm.explicacao, 70)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground font-light italic">{INSUFFICIENT}</p>
            )}
          </div>

          {/* Risco de Perda */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="metric-label">Risco de perda</span>
            </div>
            <div className={cn('metric-display text-3xl', riskConfig[riscoPerda.nivel]?.color || 'text-muted-foreground')}>
              {riskConfig[riscoPerda.nivel]?.label || INSUFFICIENT}
            </div>
            <p className="text-xs text-muted-foreground font-light mt-2 line-clamp-1">
              {shorten(riscoPerda.justificativa, 70) || INSUFFICIENT}
            </p>
          </div>

          {/* Sensibilidade Promo */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <BadgePercent className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="metric-label">Sensível a promo</span>
            </div>
            <div className={cn('metric-display text-3xl', sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.color || 'text-muted-foreground')}>
              {sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.label || INSUFFICIENT}
            </div>
            <p className="text-xs text-muted-foreground font-light mt-2 line-clamp-1">
              {shorten(analysis.sensibilidade_promocao.justificativa, 70) || INSUFFICIENT}
            </p>
          </div>
        </div>

        {/* SÍNTESE */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-foreground leading-snug line-clamp-1">
            {shorten(analysis.resumo, 110) || INSUFFICIENT}
          </p>
        </div>

        {/* DETALHES EXPANSÍVEIS */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                {expanded ? 'Recolher detalhes' : 'Ver detalhes completos'}
              </span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* RFM breakdown */}
            {rfm && (
              <div className="p-4 rounded-xl border border-border/60 space-y-3">
                <p className="metric-label">Decomposição RFM</p>
                <RFMBar label="Recência" value={rfm.recencia} />
                <RFMBar label="Frequência" value={rfm.frequencia} />
                <RFMBar label="Valor" value={rfm.valor} />
              </div>
            )}

            {/* Fatores de retorno */}
            {probRetorno && (probRetorno.fatores_positivos?.length || probRetorno.fatores_negativos?.length) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {probRetorno.fatores_positivos?.length > 0 && (
                  <div className="p-3 rounded-xl border border-success/20 bg-success/5">
                    <p className="metric-label text-success mb-2">A favor</p>
                    <ul className="space-y-1">
                      {probRetorno.fatores_positivos.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-1.5 leading-snug">
                          <CheckCircle2 className="w-3 h-3 text-success shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{shorten(f, 70)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {probRetorno.fatores_negativos?.length > 0 && (
                  <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/5">
                    <p className="metric-label text-destructive mb-2">Contra</p>
                    <ul className="space-y-1">
                      {probRetorno.fatores_negativos.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-1.5 leading-snug">
                          <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{shorten(f, 70)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {/* Métricas calculadas com tratamento de ausência */}
            {analysis.metricas_calculadas && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-border/60 text-center">
                  <p className="metric-label">Cancelamento</p>
                  <p className={cn('metric-display text-2xl mt-1', analysis.metricas_calculadas.taxa_cancelamento > 30 ? 'text-destructive' : 'text-foreground')}>
                    {analysis.metricas_calculadas.taxa_cancelamento}<span className="text-sm font-light text-muted-foreground">%</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-border/60 text-center">
                  <p className="metric-label">Freq. média</p>
                  {analysis.metricas_calculadas.frequencia_media_dias != null ? (
                    <p className="metric-display text-2xl mt-1 text-foreground">
                      {analysis.metricas_calculadas.frequencia_media_dias}<span className="text-sm font-light text-muted-foreground">d</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground font-light italic mt-3">{INSUFFICIENT}</p>
                  )}
                </div>
                <div className="p-3 rounded-xl border border-border/60 text-center">
                  <p className="metric-label">Canal</p>
                  {analysis.metricas_calculadas.tipo_preferido ? (
                    <p className="text-base font-semibold capitalize mt-2 text-foreground">
                      {analysis.metricas_calculadas.tipo_preferido}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground font-light italic mt-3">{INSUFFICIENT}</p>
                  )}
                </div>
              </div>
            )}

            {/* Perfil + tendência */}
            {analysis.perfil_comportamento && (
              <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                <p className="metric-label mb-1">Perfil</p>
                <p className="text-sm text-foreground font-light leading-snug">{shorten(analysis.perfil_comportamento, 120)}</p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

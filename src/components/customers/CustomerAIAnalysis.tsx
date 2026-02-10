import { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  RefreshCw,
  Sparkles,
  BadgePercent,
  Calendar,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Minus,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

type RiskLevel = 'baixo' | 'medio' | 'alto';
type SensibilityLevel = 'baixa' | 'media' | 'alta';

type CustomerAnalysis = {
  resumo: string;
  perfil_comportamento: string;
  risco_perda: {
    nivel: RiskLevel;
    justificativa: string;
  };
  sensibilidade_promocao: {
    nivel: SensibilityLevel;
    justificativa: string;
  };
  retencao_30d: {
    nivel: SensibilityLevel;
    justificativa: string;
  };
  sugestao_acao: {
    tipo: string;
    descricao: string;
    momento_ideal?: string | null;
  };
  // Backward compatibility with old field names
  risco_churn?: {
    nivel: RiskLevel;
    justificativa: string;
  };
  probabilidade_retorno?: {
    nivel: SensibilityLevel;
    dias?: number;
    justificativa: string;
  };
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

export function CustomerAIAnalysis({ 
  customerId, 
  customerData, 
  metrics,
  historyData 
}: CustomerAIAnalysisProps) {
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
        body: {
          customer_id: customerId,
          restaurant_id: restaurantId,
          customer_data: customerData,
          metrics,
          history_data: historyData,
        }
      });

      if (fnError) throw fnError;

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
        setHasGenerated(true);
      }
    } catch (err) {
      console.error('[CustomerAIAnalysis] Error:', err);
      setError('Não foi possível gerar a análise. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Não gera automaticamente - só quando o usuário clicar em "Gerar"

  // Estado inicial - sem dados suficientes
  if (metrics.total_visits === 0 && !loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Brain className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            Dados insuficientes para análise de IA.
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            O cliente precisa ter pelo menos uma visita registrada.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Estado inicial - pronto para gerar (só mostra se ainda não gerou)
  if (!hasGenerated && !loading && !analysis) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Análise de IA</CardTitle>
              <CardDescription className="text-xs">Clique em "Gerar" para analisar o comportamento do cliente</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Button onClick={fetchAnalysis} className="gap-2">
            <Brain className="w-4 h-4" />
            Gerar Análise de IA
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            A análise é gerada pela MesaClik IA com base no histórico do cliente.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pb-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <CardTitle className="text-lg">Análise de IA</CardTitle>
          </div>
          <CardDescription>Analisando comportamento do cliente...</CardDescription>
        </CardHeader>
        <CardContent className="py-8">
          <div className="space-y-4">
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
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
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  // Handle backward compatibility with old field names
  const riscoPerda = analysis.risco_perda || analysis.risco_churn;
  const retencao30d = analysis.retencao_30d || analysis.probabilidade_retorno;

  if (!riscoPerda || !retencao30d) return null;

  const RiskIcon = riskConfig[riscoPerda.nivel]?.icon || Minus;
  const ActionIcon = actionTypeConfig[analysis.sugestao_acao.tipo]?.icon || Target;
  
  // Check if action is "no action needed"
  const isNoAction = analysis.sugestao_acao.tipo === 'nao_agir' || analysis.sugestao_acao.tipo === 'acompanhar';

  return (
    <Card className="overflow-hidden">
      {/* Header com gradiente premium */}
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Análise de IA</CardTitle>
              <CardDescription className="text-xs">Análise gerada pela MesaClik IA</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchAnalysis} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {/* Resumo Executivo */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Resumo Inteligente</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {analysis.resumo}
              </p>
            </div>
          </div>
        </div>

        {/* Perfil de Comportamento */}
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Perfil de Comportamento
          </p>
          <p className="text-sm text-muted-foreground pl-6 leading-relaxed">
            {analysis.perfil_comportamento}
          </p>
        </div>

        <Separator />

        {/* Cards de Métricas IA */}
        <div className="grid grid-cols-3 gap-3">
          {/* Risco de Perda */}
          <div className={cn(
            "p-3 rounded-lg text-center",
            riskConfig[riscoPerda.nivel]?.bg || 'bg-muted'
          )}>
            <RiskIcon className={cn(
              "w-5 h-5 mx-auto mb-1",
              riskConfig[riscoPerda.nivel]?.color
            )} />
            <p className="text-xs text-muted-foreground">Risco de Perda</p>
            <p className={cn(
              "text-sm font-semibold",
              riskConfig[riscoPerda.nivel]?.color
            )}>
              {riskConfig[riscoPerda.nivel]?.label || riscoPerda.nivel}
            </p>
          </div>

          {/* Sensibilidade a Promoções */}
          <div className={cn(
            "p-3 rounded-lg text-center",
            sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.bg || 'bg-muted'
          )}>
            <BadgePercent className={cn(
              "w-5 h-5 mx-auto mb-1",
              sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.color
            )} />
            <p className="text-xs text-muted-foreground">Sensibilidade</p>
            <p className={cn(
              "text-sm font-semibold",
              sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.color
            )}>
              {sensibilityConfig[analysis.sensibilidade_promocao.nivel]?.label || analysis.sensibilidade_promocao.nivel}
            </p>
          </div>

          {/* Retenção 30 dias */}
          <div className={cn(
            "p-3 rounded-lg text-center",
            sensibilityConfig[retencao30d.nivel]?.bg || 'bg-muted'
          )}>
            <Calendar className={cn(
              "w-5 h-5 mx-auto mb-1",
              sensibilityConfig[retencao30d.nivel]?.color
            )} />
            <p className="text-xs text-muted-foreground">Retenção (30d)</p>
            <p className={cn(
              "text-sm font-semibold",
              sensibilityConfig[retencao30d.nivel]?.color
            )}>
              {sensibilityConfig[retencao30d.nivel]?.label || retencao30d.nivel}
            </p>
          </div>
        </div>

        {/* Justificativas */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p><strong>Risco de Perda:</strong> {riscoPerda.justificativa}</p>
          <p><strong>Promoções:</strong> {analysis.sensibilidade_promocao.justificativa}</p>
          <p><strong>Retenção:</strong> {retencao30d.justificativa}</p>
        </div>

        <Separator />

        {/* Sugestão de Ação */}
        <div className={cn(
          "p-4 rounded-lg border",
          isNoAction 
            ? "bg-success/5 border-success/20" 
            : "bg-primary/5 border-primary/20"
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-lg bg-background"
            )}>
              <ActionIcon className={cn(
                "w-5 h-5",
                actionTypeConfig[analysis.sugestao_acao.tipo]?.color || 'text-muted-foreground'
              )} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold">Sugestão Inteligente</p>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-xs",
                    isNoAction && "bg-success/10 text-success border-success/30"
                  )}
                >
                  {actionTypeConfig[analysis.sugestao_acao.tipo]?.label || analysis.sugestao_acao.tipo}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {analysis.sugestao_acao.descricao}
              </p>
              {analysis.sugestao_acao.momento_ideal && (
                <p className="text-xs text-primary mt-2 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  {analysis.sugestao_acao.momento_ideal}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
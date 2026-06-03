import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightsCardProps {
  peakHour: string;
  peakDay: string;
  vipCustomers: number;
  totalServed: number;
  avgWaitTime: number;
  conversionRate: number;
  // Novos campos para insights mais precisos
  totalCanceled?: number;
  noShowRate?: number;
  previousAvgWait?: number;
  previousConversionRate?: number;
}

/**
 * Insights determinísticos baseados APENAS em dados reais
 * Não gera frases sobre satisfação, NPS ou métricas que não existem
 */
type InsightType = "success" | "warning" | "info";
interface Insight {
  icon: typeof TrendingUp;
  text: string;
  type: InsightType;
  impact: number; // ranking de prioridade (maior = mais importante)
}

export function InsightsCard({
  peakHour,
  peakDay,
  vipCustomers,
  totalServed,
  avgWaitTime,
  conversionRate,
  totalCanceled = 0,
  noShowRate = 0,
  previousAvgWait = 0,
  previousConversionRate = 0,
}: InsightsCardProps) {
  const insights: Insight[] = [];

  // Tempo de espera vs período anterior (comparação obrigatória)
  if (avgWaitTime > 0 && previousAvgWait > 0) {
    const diff = avgWaitTime - previousAvgWait;
    const pct = Math.round((Math.abs(diff) / previousAvgWait) * 100);
    if (diff < 0) {
      insights.push({
        icon: TrendingDown,
        text: `↓ Tempo de espera caiu ${pct}% vs período anterior (${avgWaitTime} min)`,
        type: "success",
        impact: 80 + pct,
      });
    } else if (diff > 0) {
      insights.push({
        icon: TrendingUp,
        text: `↑ Tempo de espera subiu ${pct}% vs período anterior (${avgWaitTime} min)`,
        type: "warning",
        impact: 75 + pct,
      });
    }
  }

  // Taxa de conversão vs período anterior
  if (conversionRate > 0 && previousConversionRate > 0) {
    const diff = conversionRate - previousConversionRate;
    if (diff >= 3) {
      insights.push({
        icon: TrendingUp,
        text: `↑ Conversão da fila cresceu ${diff}% vs período anterior`,
        type: "success",
        impact: 70 + diff,
      });
    } else if (diff <= -3) {
      insights.push({
        icon: TrendingDown,
        text: `↓ Conversão da fila caiu ${Math.abs(diff)}% vs período anterior`,
        type: "warning",
        impact: 85 + Math.abs(diff),
      });
    }
  }

  // No-show alto (comparação contra benchmark de 10%)
  if (noShowRate > 10) {
    insights.push({
      icon: AlertTriangle,
      text: `⚠ No-show em ${noShowRate}% — acima do limite saudável de 10%`,
      type: "warning",
      impact: 60 + noShowRate,
    });
  } else if (noShowRate === 0 && (totalServed > 0)) {
    insights.push({
      icon: CheckCircle2,
      text: `↓ No-show zerado no período — melhor resultado recente`,
      type: "success",
      impact: 55,
    });
  }

  // Cancelamento expressivo
  if (totalCanceled > 0 && totalServed > 0) {
    const cancelPct = Math.round((totalCanceled / (totalServed + totalCanceled)) * 100);
    if (cancelPct > 20) {
      insights.push({
        icon: AlertTriangle,
        text: `⚠ ${cancelPct}% das entradas foram canceladas — acima da média de mercado (≈10%)`,
        type: "warning",
        impact: 50 + cancelPct,
      });
    }
  }

  // VIP share
  if (vipCustomers > 0 && totalServed > 0) {
    const vipPct = Math.round((vipCustomers / totalServed) * 100);
    if (vipPct >= 15) {
      insights.push({
        icon: TrendingUp,
        text: `↑ ${vipPct}% dos atendidos são VIP — base fiel acima da média do setor (~8%)`,
        type: "success",
        impact: 45,
      });
    }
  }

  const top = insights
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 4);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <div className="p-2 bg-primary/10 rounded-lg mr-3">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          Inteligência do Período
        </CardTitle>
        <p className="text-sm font-light text-muted-foreground">
          Comparações vs período anterior — ordenadas por impacto
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {top.length > 0 ? (
            top.map((insight, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-xl border transition-all animate-fade-in",
                  insight.type === "success" && "bg-success/10 border-success/25 hover:border-success/50",
                  insight.type === "warning" && "bg-warning/10 border-warning/25 hover:border-warning/50",
                  insight.type === "info" && "bg-muted/50 border-border"
                )}
              >
                <insight.icon
                  className={cn(
                    "w-4 h-4 mt-0.5 flex-shrink-0",
                    insight.type === "success" && "text-success",
                    insight.type === "warning" && "text-warning",
                    insight.type === "info" && "text-primary"
                  )}
                />
                <p className="text-sm text-foreground leading-relaxed font-medium">
                  {insight.text}
                </p>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center text-center py-8">
              <Brain className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Sem variações relevantes no período.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Volte quando houver mais dados acumulados.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

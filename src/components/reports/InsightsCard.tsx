import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, TrendingDown, Clock, Users, Calendar, AlertTriangle } from "lucide-react";

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
  // Gerar insights DETERMINÍSTICOS baseados apenas em dados reais
  const insights: Array<{
    icon: typeof Lightbulb;
    text: string;
    type: "success" | "warning" | "info";
  }> = [];

  // Insight: Dia de pico (se houver dados)
  if (peakDay && peakDay !== '-') {
    const dayCapitalized = peakDay.charAt(0).toUpperCase() + peakDay.slice(1);
    insights.push({
      icon: Calendar,
      text: `${dayCapitalized} apresenta o maior volume de entradas no período analisado.`,
      type: "info",
    });
  }

  // Insight: Horário de pico (se houver dados)
  if (peakHour && peakHour !== '-') {
    insights.push({
      icon: Clock,
      text: `O horário das ${peakHour} concentra a maioria das entradas.`,
      type: "info",
    });
  }

  // Insight: Tempo de espera comparativo
  if (avgWaitTime > 0 && previousAvgWait > 0) {
    const diff = avgWaitTime - previousAvgWait;
    if (diff < 0) {
      insights.push({
        icon: TrendingDown,
        text: `Tempo médio de espera reduziu ${Math.abs(diff)} minutos em relação ao período anterior.`,
        type: "success",
      });
    } else if (diff > 5) {
      insights.push({
        icon: TrendingUp,
        text: `Tempo médio de espera aumentou ${diff} minutos. Considere otimizar o fluxo de atendimento.`,
        type: "warning",
      });
    }
  } else if (avgWaitTime > 0) {
    // Sem comparativo, apenas informar o tempo atual
    if (avgWaitTime <= 15) {
      insights.push({
        icon: Clock,
        text: `Tempo médio de espera de ${avgWaitTime} minutos está dentro da média ideal.`,
        type: "success",
      });
    } else if (avgWaitTime > 30) {
      insights.push({
        icon: AlertTriangle,
        text: `Tempo médio de espera de ${avgWaitTime} minutos. Considere estratégias para reduzir.`,
        type: "warning",
      });
    }
  }

  // Insight: Taxa de conversão comparativa
  if (conversionRate > 0 && previousConversionRate > 0) {
    const diff = conversionRate - previousConversionRate;
    if (diff > 5) {
      insights.push({
        icon: TrendingUp,
        text: `Taxa de conversão subiu ${diff}% em relação ao período anterior.`,
        type: "success",
      });
    } else if (diff < -5) {
      insights.push({
        icon: TrendingDown,
        text: `Taxa de conversão caiu ${Math.abs(diff)}% em relação ao período anterior.`,
        type: "warning",
      });
    }
  }

  // Insight: VIP (apenas se houver dados)
  if (vipCustomers > 0 && totalServed > 0) {
    const vipPercentage = Math.round((vipCustomers / totalServed) * 100);
    if (vipPercentage >= 10) {
      insights.push({
        icon: Users,
        text: `Clientes VIP (5+ visitas) representam ${vipPercentage}% da base. Considere programas de fidelização.`,
        type: "success",
      });
    }
  }

  // Insight: Cancelamentos (se significativo)
  if (totalCanceled > 0 && totalServed > 0) {
    const cancelPercentage = Math.round((totalCanceled / (totalServed + totalCanceled)) * 100);
    if (cancelPercentage > 20) {
      insights.push({
        icon: AlertTriangle,
        text: `${cancelPercentage}% das entradas foram canceladas. Analise os motivos para reduzir esse índice.`,
        type: "warning",
      });
    }
  }

  // Insight: No-show (se houver dados)
  if (noShowRate > 10) {
    insights.push({
      icon: AlertTriangle,
      text: `Taxa de não comparecimento de ${noShowRate}%. Considere confirmação prévia via SMS.`,
      type: "warning",
    });
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <div className="p-2 bg-primary/10 rounded-lg mr-3">
            <Lightbulb className="w-5 h-5 text-primary" />
          </div>
          Insights do Período
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Análises baseadas nos dados reais do seu restaurante
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.length > 0 ? (
            insights.map((insight, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                  insight.type === "success"
                    ? "bg-success/10 border border-success/20"
                    : insight.type === "warning"
                    ? "bg-warning/10 border border-warning/20"
                    : "bg-muted/50 border border-border"
                }`}
              >
                <insight.icon
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    insight.type === "success"
                      ? "text-success"
                      : insight.type === "warning"
                      ? "text-warning"
                      : "text-primary"
                  }`}
                />
                <p className="text-sm text-foreground leading-relaxed">
                  {insight.text}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Dados insuficientes para gerar insights no período selecionado.
              <br />
              <span className="text-xs">Adicione mais entradas na fila ou reservas para ver análises.</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

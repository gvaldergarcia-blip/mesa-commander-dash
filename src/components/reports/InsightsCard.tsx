import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, Clock, Users, Calendar } from "lucide-react";

interface InsightsCardProps {
  peakHour: string;
  peakDay: string;
  vipCustomers: number;
  totalServed: number;
  avgWaitTime: number;
  conversionRate: number;
}

export function InsightsCard({
  peakHour,
  peakDay,
  vipCustomers,
  totalServed,
  avgWaitTime,
  conversionRate,
}: InsightsCardProps) {
  // Gerar insights dinâmicos baseados nos dados
  const insights = [];

  if (peakDay) {
    insights.push({
      icon: Calendar,
      text: `${peakDay.charAt(0).toUpperCase() + peakDay.slice(1)} apresenta o maior movimento da semana`,
      type: "info" as const,
    });
  }

  if (peakHour) {
    insights.push({
      icon: Clock,
      text: `O horário das ${peakHour} concentra a maioria das entradas`,
      type: "info" as const,
    });
  }

  if (vipCustomers > 0 && totalServed > 0) {
    const vipPercentage = Math.round((vipCustomers / totalServed) * 100);
    if (vipPercentage > 0) {
      insights.push({
        icon: Users,
        text: `Clientes VIP representam ${vipPercentage}% do potencial de fidelização`,
        type: "success" as const,
      });
    }
  }

  if (avgWaitTime > 0) {
    if (avgWaitTime <= 15) {
      insights.push({
        icon: TrendingUp,
        text: `Tempo de espera excelente, mantendo clientes satisfeitos`,
        type: "success" as const,
      });
    } else if (avgWaitTime > 30) {
      insights.push({
        icon: Clock,
        text: `Considere estratégias para reduzir o tempo de espera`,
        type: "warning" as const,
      });
    }
  }

  if (conversionRate >= 80) {
    insights.push({
      icon: TrendingUp,
      text: `Taxa de conversão acima da média do mercado`,
      type: "success" as const,
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
          Análises automáticas baseadas no desempenho do seu restaurante
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
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

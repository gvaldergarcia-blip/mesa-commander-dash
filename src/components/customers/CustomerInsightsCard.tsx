import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Calendar, Zap, Send, ArrowUpRight } from "lucide-react";

interface CustomerInsightsProps {
  preferredTime: string | null;
  preferredDay: string | null;
  avgPartySize: number;
  preferredChannel: string;
  showRate: number;
  customerAvgWait: number | null;
  restaurantAvgWait: number;
  daysSinceLastVisit: number | null;
  marketingOptIn: boolean;
}

export function CustomerInsights({
  preferredTime,
  preferredDay,
  avgPartySize,
  preferredChannel,
  showRate,
  customerAvgWait,
  restaurantAvgWait,
  daysSinceLastVisit,
  marketingOptIn,
}: CustomerInsightsProps) {
  const insights: { icon: typeof Clock; text: string; type: 'info' | 'warning' | 'suggestion' }[] = [];

  if (preferredDay && preferredTime) {
    insights.push({
      icon: Calendar,
      text: `Cliente costuma vir: ${preferredDay} ${preferredTime}–${parseInt(preferredTime) + 1}:00`,
      type: 'info',
    });
  } else if (preferredTime) {
    insights.push({
      icon: Calendar,
      text: `Horário preferido: ${preferredTime}–${parseInt(preferredTime) + 1}:00`,
      type: 'info',
    });
  }

  if (avgPartySize > 0) {
    insights.push({
      icon: Users,
      text: `Grupo médio: ${avgPartySize} pessoa(s)`,
      type: 'info',
    });
  }

  insights.push({
    icon: Zap,
    text: `Canal preferido: ${preferredChannel === 'queue' ? 'Fila' : 'Reserva'}`,
    type: 'info',
  });

  if (customerAvgWait && restaurantAvgWait > 0) {
    const diff = customerAvgWait - restaurantAvgWait;
    if (diff > 5) {
      insights.push({
        icon: Clock,
        text: `Espera acima da média: ${customerAvgWait} min vs ${restaurantAvgWait} min do restaurante`,
        type: 'warning',
      });
    }
  }

  if (daysSinceLastVisit !== null && daysSinceLastVisit > 30 && marketingOptIn) {
    insights.push({
      icon: Send,
      text: 'Sugestão: Enviar promoção para retorno',
      type: 'suggestion',
    });
  }

  if (customerAvgWait && restaurantAvgWait > 0 && customerAvgWait > restaurantAvgWait * 1.3) {
    insights.push({
      icon: ArrowUpRight,
      text: 'Sugestão: Priorizar atendimento na próxima visita',
      type: 'suggestion',
    });
  }

  if (insights.length === 0) return null;

  const typeStyles = {
    info: 'bg-muted/50',
    warning: 'bg-warning/5',
    suggestion: 'bg-primary/5',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Insights e Recomendações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          return (
            <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-lg ${typeStyles[insight.type]}`}>
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{insight.text}</span>
              {insight.type === 'suggestion' && (
                <Badge variant="secondary" className="text-[10px] ml-auto flex-shrink-0">Sugestão</Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

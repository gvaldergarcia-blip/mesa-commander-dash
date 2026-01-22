import { Sparkles, AlertCircle, Send, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PalpitesStats as Stats } from '@/hooks/useAIPalpites';

interface PalpitesStatsProps {
  stats: Stats;
}

export function PalpitesStats({ stats }: PalpitesStatsProps) {
  const cards = [
    {
      title: 'Total de Palpites',
      value: stats.total,
      icon: Lightbulb,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Novos',
      value: stats.new_count,
      icon: Sparkles,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Alta Prioridade',
      value: stats.high_priority,
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Enviados',
      value: stats.sent_count,
      icon: Send,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

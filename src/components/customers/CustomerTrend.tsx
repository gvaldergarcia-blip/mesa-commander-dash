import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CustomerTrendProps {
  direction: 'up' | 'down' | 'stable';
  diff: number;
  last30d: number;
  prev30d: number;
}

const trendConfig = {
  up: {
    icon: TrendingUp,
    label: 'Em crescimento',
    className: 'bg-success/15 text-success border-success/30',
  },
  down: {
    icon: TrendingDown,
    label: 'Em queda',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  stable: {
    icon: Minus,
    label: 'Estável',
    className: 'bg-muted text-muted-foreground border-muted',
  },
};

export function CustomerTrend({ direction, diff, last30d, prev30d }: CustomerTrendProps) {
  const config = trendConfig[direction];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1.5 text-xs font-medium", config.className)}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
      {diff !== 0 && (
        <span className="font-bold">
          ({diff > 0 ? '+' : ''}{diff})
        </span>
      )}
    </Badge>
  );
}

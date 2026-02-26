import { AlertTriangle, AlertCircle, Info, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Alert = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  cta: string | null;
};

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    className: 'bg-destructive/10 border-destructive/30 text-destructive',
    badgeClass: 'bg-destructive text-destructive-foreground',
    label: 'Crítico',
  },
  warning: {
    icon: AlertCircle,
    className: 'bg-warning/10 border-warning/30 text-warning',
    badgeClass: 'bg-warning text-warning-foreground',
    label: 'Atenção',
  },
  info: {
    icon: Info,
    className: 'bg-primary/10 border-primary/30 text-primary',
    badgeClass: 'bg-primary text-primary-foreground',
    label: 'Info',
  },
};

interface CustomerAlertsProps {
  alerts: Alert[];
  onSendPromotion?: () => void;
  onViewEvents?: () => void;
}

export function CustomerAlerts({ alerts, onSendPromotion, onViewEvents }: CustomerAlertsProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Alertas Importantes
      </h3>
      <div className="space-y-2">
        {alerts.map((alert) => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                config.className
              )}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="flex-1 text-sm font-medium">{alert.title}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={cn("text-[10px]", config.badgeClass)}>
                  {config.label}
                </Badge>
                {alert.cta === 'enviar_promocao' && onSendPromotion && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onSendPromotion}>
                    <Send className="w-3 h-3" />
                    Enviar promoção
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, Send, Clock,
  Calendar, Users as UsersIcon, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimelineEvent = {
  id: string;
  type: string; // 'queue' | 'reservation' | 'promotion'
  status: string;
  date: string;
  party_size?: number;
  wait_time?: number;
  cancel_actor?: string;
  subject?: string;
  source?: string;
};

type FilterType = 'all' | 'queue' | 'reservation' | 'promotion' | 'canceled';

const eventConfig: Record<string, {
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  label: string;
}> = {
  queue_completed: {
    icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10', label: 'Fila concluída',
  },
  reservation_completed: {
    icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10', label: 'Reserva concluída',
  },
  queue_waiting: {
    icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'Na fila',
  },
  reservation_pending: {
    icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'Reserva pendente',
  },
  reservation_confirmed: {
    icon: CheckCircle2, color: 'text-primary', bgColor: 'bg-primary/10', label: 'Reserva confirmada',
  },
  canceled_by_restaurant: {
    icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Cancelado pelo restaurante',
  },
  canceled_by_customer: {
    icon: XCircle, color: 'text-warning', bgColor: 'bg-warning/10', label: 'Cancelado pelo cliente',
  },
  no_show: {
    icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10', label: 'Não compareceu',
  },
  promotion_sent: {
    icon: Send, color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Promoção enviada',
  },
};

function getEventKey(event: TimelineEvent): string {
  if (event.type === 'promotion') return 'promotion_sent';
  if (event.status === 'no_show') return 'no_show';
  if (event.status === 'canceled') {
    const actor = (event.cancel_actor || '').toLowerCase();
    if (actor === 'restaurant' || actor === 'restaurante' || actor === 'admin' || actor === 'panel') {
      return 'canceled_by_restaurant';
    }
    return 'canceled_by_customer';
  }
  if (event.type === 'queue') {
    return event.status === 'seated' ? 'queue_completed' : 'queue_waiting';
  }
  if (event.type === 'reservation') {
    if (event.status === 'completed') return 'reservation_completed';
    if (event.status === 'confirmed') return 'reservation_confirmed';
    return 'reservation_pending';
  }
  return 'queue_waiting';
}

interface CustomerTimelineProps {
  events: TimelineEvent[];
}

export function CustomerTimeline({ events }: CustomerTimelineProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'queue') return e.type === 'queue';
    if (filter === 'reservation') return e.type === 'reservation';
    if (filter === 'promotion') return e.type === 'promotion';
    if (filter === 'canceled') return e.status === 'canceled' || e.status === 'no_show';
    return true;
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">Histórico de Interações</CardTitle>
            <CardDescription>Fila, reservas e promoções</CardDescription>
          </div>
          <div className="flex gap-1 flex-wrap">
            {([
              { key: 'all', label: 'Todos' },
              { key: 'queue', label: '🎫 Fila' },
              { key: 'reservation', label: '📅 Reserva' },
              { key: 'promotion', label: '✉️ Promo' },
              { key: 'canceled', label: '❌ Cancelamentos' },
            ] as { key: FilterType; label: string }[]).map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'default' : 'ghost'}
                className="h-7 text-xs px-2"
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma interação encontrada
          </div>
        ) : (
          <div className="space-y-1">
            {filteredEvents.slice(0, 30).map((event, index) => {
              const key = getEventKey(event);
              const config = eventConfig[key] || eventConfig.queue_waiting;
              const Icon = config.icon;
              const isCancelByRestaurant = key === 'canceled_by_restaurant';

              return (
                <div key={event.id + '-' + index} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className={cn("p-1.5 rounded-full", config.bgColor, config.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {index < filteredEvents.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className={cn(
                    "flex-1 pb-3",
                    isCancelByRestaurant && "bg-destructive/5 -mx-2 px-2 py-1.5 rounded-md border border-destructive/20"
                  )}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm font-medium", config.color)}>
                        {config.label}
                      </span>
                      {event.party_size && (
                        <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                          <UsersIcon className="w-3 h-3" />
                          {event.party_size}
                        </Badge>
                      )}
                      {event.wait_time && event.wait_time > 0 && (
                        <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                          <Clock className="w-3 h-3" />
                          {event.wait_time} min
                        </Badge>
                      )}
                      {event.subject && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {event.subject}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(event.date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

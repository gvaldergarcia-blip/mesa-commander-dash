import { Clock, CheckCircle, XCircle, AlertTriangle, Calendar, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ReservationStatus = 'all' | 'pending' | 'confirmed' | 'completed' | 'canceled' | 'no_show';

interface StatusCount {
  pending: number;
  confirmed: number;
  completed: number;
  canceled: number;
  no_show: number;
}

interface ReservationStatusFilterProps {
  statusFilter: string;
  onStatusChange: (status: ReservationStatus) => void;
  counts: StatusCount;
}

const statusConfig: Record<ReservationStatus, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string;
  activeColor: string;
}> = {
  all: { 
    label: "Todos", 
    icon: Calendar, 
    color: "text-muted-foreground",
    activeColor: "border-primary bg-primary/10 ring-1 ring-primary"
  },
  pending: { 
    label: "Pendentes", 
    icon: Clock, 
    color: "text-warning",
    activeColor: "border-warning bg-warning/10 ring-1 ring-warning"
  },
  confirmed: { 
    label: "Confirmadas", 
    icon: CheckCircle, 
    color: "text-success",
    activeColor: "border-success bg-success/10 ring-1 ring-success"
  },
  completed: { 
    label: "Concluídas", 
    icon: Users, 
    color: "text-primary",
    activeColor: "border-primary bg-primary/10 ring-1 ring-primary"
  },
  canceled: { 
    label: "Canceladas", 
    icon: XCircle, 
    color: "text-destructive",
    activeColor: "border-destructive bg-destructive/10 ring-1 ring-destructive"
  },
  no_show: { 
    label: "Não compareceu", 
    icon: AlertTriangle, 
    color: "text-orange-500",
    activeColor: "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500"
  },
};

export function ReservationStatusFilter({
  statusFilter,
  onStatusChange,
  counts,
}: ReservationStatusFilterProps) {
  const statuses: ReservationStatus[] = ['all', 'pending', 'confirmed', 'completed', 'canceled', 'no_show'];
  
  const getCount = (status: ReservationStatus): number => {
    if (status === 'all') {
      return counts.pending + counts.confirmed + counts.completed + counts.canceled + counts.no_show;
    }
    return counts[status];
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Filtrar por Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {statuses.map((status) => {
            const config = statusConfig[status];
            const Icon = config.icon;
            const count = getCount(status);
            const isActive = statusFilter === status;
            
            return (
              <button
                key={status}
                onClick={() => onStatusChange(status)}
                className={cn(
                  "p-3 rounded-lg border text-left transition-all",
                  isActive 
                    ? config.activeColor
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("h-4 w-4", isActive ? config.color : "text-muted-foreground")} />
                  <span className={cn("text-lg font-bold", isActive ? config.color : "")}>{count}</span>
                </div>
                <div className="text-xs text-muted-foreground">{config.label}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          💡 Clique em um status para filtrar as reservas.
        </p>
      </CardContent>
    </Card>
  );
}

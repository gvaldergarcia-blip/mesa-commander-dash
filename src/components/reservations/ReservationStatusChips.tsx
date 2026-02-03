import { Calendar, CheckCircle, Clock, XCircle, AlertTriangle, Users } from "lucide-react";

type ReservationStatus = 'all' | 'pending' | 'confirmed' | 'completed' | 'canceled' | 'no_show';

interface StatusCount {
  pending: number;
  confirmed: number;
  completed: number;
  canceled: number;
  no_show: number;
}

interface ReservationStatusChipsProps {
  activeStatus: string;
  onStatusChange: (status: string) => void;
  counts: StatusCount;
}

const statusConfig: Record<ReservationStatus, { 
  label: string; 
  icon: typeof Calendar;
  activeClass: string;
}> = {
  all: {
    label: 'Todas',
    icon: Calendar,
    activeClass: 'border-primary bg-primary/10 ring-1 ring-primary',
  },
  pending: {
    label: 'Pendentes',
    icon: Clock,
    activeClass: 'border-yellow-500 bg-yellow-500/10 ring-1 ring-yellow-500',
  },
  confirmed: {
    label: 'Confirmadas',
    icon: CheckCircle,
    activeClass: 'border-green-500 bg-green-500/10 ring-1 ring-green-500',
  },
  completed: {
    label: 'Concluídas',
    icon: Users,
    activeClass: 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500',
  },
  canceled: {
    label: 'Canceladas',
    icon: XCircle,
    activeClass: 'border-red-500 bg-red-500/10 ring-1 ring-red-500',
  },
  no_show: {
    label: 'Não compareceu',
    icon: AlertTriangle,
    activeClass: 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500',
  },
};

export function ReservationStatusChips({ 
  activeStatus, 
  onStatusChange, 
  counts 
}: ReservationStatusChipsProps) {
  const statuses: ReservationStatus[] = ['all', 'pending', 'confirmed', 'completed', 'canceled', 'no_show'];

  const getCount = (status: ReservationStatus): number | null => {
    if (status === 'all') return null;
    return counts[status] ?? 0;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {statuses.map((status) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        const isActive = activeStatus === status;
        const count = getCount(status);

        return (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            className={`p-3 rounded-lg border text-left transition-all ${
              isActive 
                ? config.activeClass
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${isActive ? 'text-current' : 'text-muted-foreground'}`} />
              {count !== null && (
                <span className="text-lg font-bold">{count}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{config.label}</div>
          </button>
        );
      })}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "waiting" | "called" | "seated" | "canceled" | "confirmed" | "pending" | "completed" | "no_show";

const statusConfig = {
  waiting: {
    label: "Aguardando",
    className: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20"
  },
  called: {
    label: "Chamado",
    className: "bg-accent/10 text-accent border-accent/20 hover:bg-accent/20"
  },
  seated: {
    label: "Sentado",
    className: "bg-success/10 text-success border-success/20 hover:bg-success/20"
  },
  canceled: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-success/10 text-success border-success/20 hover:bg-success/20"
  },
  pending: {
    label: "Pendente",
    className: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20"
  },
  completed: {
    label: "Concluído",
    className: "bg-success/10 text-success border-success/20 hover:bg-success/20"
  },
  no_show: {
    label: "Não Compareceu",
    className: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
  }
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
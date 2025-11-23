import { Badge } from "@/components/ui/badge";
import { Star, Zap, Clock, CheckCircle } from "lucide-react";
import { CustomerStatus } from "@/hooks/useCustomersEnhanced";

type CustomerStatusBadgeProps = {
  status: CustomerStatus;
};

export function CustomerStatusBadge({ status }: CustomerStatusBadgeProps) {
  const statusConfig = {
    vip: {
      icon: Star,
      label: "VIP",
      className: "bg-accent/10 text-accent border-accent/20",
    },
    new: {
      icon: Zap,
      label: "Novo",
      className: "bg-success/10 text-success border-success/20",
    },
    inactive: {
      icon: Clock,
      label: "Inativo",
      className: "bg-muted text-muted-foreground border-muted-foreground/20",
    },
    active: {
      icon: CheckCircle,
      label: "Ativo",
      className: "bg-primary/10 text-primary border-primary/20",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

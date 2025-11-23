import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type VipBadgeProps = {
  show: boolean;
  variant?: 'default' | 'large';
};

/**
 * Badge VIP para clientes com 10+ visitas concluídas
 * Cor laranja (#FFA500) conforme especificação
 */
export function VipBadge({ show, variant = 'default' }: VipBadgeProps) {
  if (!show) return null;

  const sizeClasses = variant === 'large' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5';
  const iconSize = variant === 'large' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <Badge 
      className={`bg-[#FFA500] hover:bg-[#FF8C00] text-white border-[#FFA500] ${sizeClasses}`}
      variant="secondary"
    >
      <Star className={`${iconSize} mr-1 fill-white`} />
      VIP
    </Badge>
  );
}

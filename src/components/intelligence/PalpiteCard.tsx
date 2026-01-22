import { useState } from 'react';
import { 
  Clock, 
  UserMinus, 
  AlertTriangle, 
  Send, 
  Lock, 
  Eye, 
  X,
  Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIPalpite } from '@/hooks/useAIPalpites';
import { cn } from '@/lib/utils';

interface PalpiteCardProps {
  palpite: AIPalpite;
  onMarkSeen: (id: string) => Promise<boolean>;
  onDismiss: (id: string) => Promise<boolean>;
  onSendPromotion: (palpite: AIPalpite) => void;
}

const typeConfig = {
  LONG_WAIT_RECOVERY: {
    icon: Clock,
    label: 'Longa Espera',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  WINBACK: {
    icon: UserMinus,
    label: 'Reconquistar',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  CHURN_RISK: {
    icon: AlertTriangle,
    label: 'Risco de Churn',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
};

const priorityConfig = {
  high: { label: 'Alta', variant: 'destructive' as const },
  med: { label: 'Média', variant: 'default' as const },
  low: { label: 'Baixa', variant: 'secondary' as const },
};

const statusConfig = {
  new: { label: 'Novo', variant: 'default' as const, className: '' },
  seen: { label: 'Visto', variant: 'secondary' as const, className: '' },
  dismissed: { label: 'Dispensado', variant: 'outline' as const, className: '' },
  sent: { label: 'Enviado', variant: 'default' as const, className: 'bg-green-500' },
};

export function PalpiteCard({ 
  palpite, 
  onMarkSeen, 
  onDismiss, 
  onSendPromotion 
}: PalpiteCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const typeInfo = typeConfig[palpite.type];
  const priorityInfo = priorityConfig[palpite.priority];
  const statusInfo = statusConfig[palpite.status];
  const TypeIcon = typeInfo.icon;

  const handleMarkSeen = async () => {
    if (palpite.status !== 'new') return;
    setIsProcessing(true);
    await onMarkSeen(palpite.id);
    setIsProcessing(false);
  };

  const handleDismiss = async () => {
    if (palpite.status === 'dismissed' || palpite.status === 'sent') return;
    setIsProcessing(true);
    await onDismiss(palpite.id);
    setIsProcessing(false);
  };

  const isActionable = palpite.status !== 'dismissed' && palpite.status !== 'sent';

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      palpite.status === 'new' && "border-l-4 border-l-primary",
      palpite.status === 'dismissed' && "opacity-60",
      palpite.status === 'sent' && "border-l-4 border-l-green-500"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", typeInfo.bgColor)}>
              <TypeIcon className={cn("h-4 w-4", typeInfo.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{typeInfo.label}</span>
                <Badge variant={priorityInfo.variant} className="text-xs">
                  {priorityInfo.label}
                </Badge>
                <Badge 
                  variant={statusInfo.variant} 
                  className={cn("text-xs", statusInfo.className)}
                >
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(palpite.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Quick actions */}
          {isActionable && (
            <div className="flex items-center gap-1">
              {palpite.status === 'new' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleMarkSeen}
                  disabled={isProcessing}
                  title="Marcar como visto"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleDismiss}
                disabled={isProcessing}
                title="Dispensar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Customer info */}
        <div className="mb-3">
          <p className="font-semibold text-foreground">
            {palpite.customer_name || 'Cliente sem nome'}
          </p>
          <p className="text-sm text-muted-foreground">
            {palpite.customer_email || 'Sem email'}
          </p>
        </div>

        {/* Palpite content */}
        <div className="mb-4">
          <h4 className="font-medium text-sm mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {palpite.title}
          </h4>
          <p className="text-sm text-muted-foreground">{palpite.message}</p>
        </div>

        {/* Suggested promotion preview */}
        {palpite.cta_payload && (
          <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm">
            <p className="font-medium text-xs text-muted-foreground mb-1">
              Sugestão de promoção:
            </p>
            <p className="font-medium">{palpite.cta_payload.subject}</p>
            {palpite.cta_payload.coupon_code && (
              <p className="text-muted-foreground">
                Cupom: <span className="font-mono font-medium">{palpite.cta_payload.coupon_code}</span>
                {palpite.cta_payload.discount_percent && (
                  <span> ({palpite.cta_payload.discount_percent}% off)</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Action button */}
        {isActionable && (
          <div className="flex items-center justify-end">
            {palpite.action_allowed ? (
              <Button 
                size="sm" 
                className="gap-2"
                onClick={() => onSendPromotion(palpite)}
              >
                <Send className="h-4 w-4" />
                Enviar promoção
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Cliente não autorizou ofertas</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Lightbulb, Send, Lock, TrendingUp, UserMinus, Star, UserPlus, X, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { InsightType } from '@/hooks/useCustomerInsights';

interface CustomerInsightBadgeProps {
  insightType: InsightType;
  message: string;
  actionAllowed: boolean;
  onSendPromotion?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

const insightConfig: Record<InsightType, {
  icon: typeof Lightbulb;
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
}> = {
  queue_dropout: {
    icon: UserMinus,
    label: 'Desistiu da fila',
    variant: 'destructive',
    color: 'text-destructive',
  },
  reservation_canceled: {
    icon: AlertTriangle,
    label: 'Reserva cancelada',
    variant: 'destructive',
    color: 'text-warning',
  },
  inactive: {
    icon: UserMinus,
    label: 'Inativo',
    variant: 'secondary',
    color: 'text-muted-foreground',
  },
  recurrent: {
    icon: TrendingUp,
    label: 'Frequente',
    variant: 'default',
    color: 'text-success',
  },
  vip_missing: {
    icon: Star,
    label: 'VIP ausente',
    variant: 'outline',
    color: 'text-yellow-600',
  },
  new_customer: {
    icon: UserPlus,
    label: 'Novo cliente',
    variant: 'default',
    color: 'text-primary',
  },
};

/**
 * Componente que exibe insight do cliente com ação condicional
 * Segue LGPD: só mostra botão de ação se cliente autorizou marketing
 */
export function CustomerInsightBadge({
  insightType,
  message,
  actionAllowed,
  onSendPromotion,
  onDismiss,
  compact = false,
}: CustomerInsightBadgeProps) {
  const config = insightConfig[insightType];
  const Icon = config.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Badge variant={config.variant} className="gap-1 text-xs">
                <Icon className="w-3 h-3" />
                {config.label}
              </Badge>
              {actionAllowed ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendPromotion?.();
                  }}
                >
                  <Send className="w-3 h-3" />
                </Button>
              ) : (
                <Lock className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-2">
              <p className="text-sm">{message}</p>
              {!actionAllowed && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Cliente não autorizou comunicações promocionais
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 border-border">
      <div className={`p-2 rounded-lg bg-background ${config.color}`}>
        <Lightbulb className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={config.variant} className="gap-1 text-xs">
            <Icon className="w-3 h-3" />
            {config.label}
          </Badge>
        </div>
        
        <p className="text-sm text-foreground mb-2">{message}</p>
        
        {actionAllowed ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onSendPromotion?.();
              }}
            >
              <Send className="w-3.5 h-3.5" />
              Enviar promoção
            </Button>
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
              >
                <X className="w-3.5 h-3.5" />
                Dispensar
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            Cliente não autorizou comunicações promocionais
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Versão inline do insight para usar em tabelas
 */
export function CustomerInsightInline({
  insightType,
  message,
  actionAllowed,
  onSendPromotion,
}: Omit<CustomerInsightBadgeProps, 'onDismiss' | 'compact'>) {
  const config = insightConfig[insightType];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className="gap-1 text-xs cursor-help">
              <Icon className="w-3 h-3" />
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{message}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {actionAllowed ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-primary hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onSendPromotion?.();
                }}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar promoção</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Lock className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              Cliente não autorizou comunicações promocionais
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

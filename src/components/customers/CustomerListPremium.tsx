import { Send, Star, TrendingUp, Zap, AlertTriangle, Mail, MailPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RestaurantCustomer } from "@/hooks/useRestaurantCustomers";
import { cn } from "@/lib/utils";

type CustomerStatus = 'frequent' | 'new' | 'vip' | 'at_risk' | 'promoter' | 'active';

type CustomerListPremiumProps = {
  customers: RestaurantCustomer[];
  onViewProfile: (customerId: string) => void;
  onSendPromotion: (customer: RestaurantCustomer) => void;
  onRequestConsent?: (customer: RestaurantCustomer) => void;
  getInsightMessage: (customer: RestaurantCustomer) => string | null;
};

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getDaysAgo(dateString: string) {
  const date = new Date(dateString);
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return `${days} dias atrás`;
}

function getCustomerStatuses(customer: RestaurantCustomer): CustomerStatus[] {
  const statuses: CustomerStatus[] = [];
  const lastSeen = new Date(customer.last_seen_at);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const createdAt = new Date(customer.created_at);

  // VIP (10+ visitas)
  if (customer.vip || customer.total_visits >= 10) {
    statuses.push('vip');
  }

  // Frequente (3+ visitas)
  if (customer.total_visits >= 3 && customer.total_visits < 10) {
    statuses.push('frequent');
  }

  // Novo (criado nos últimos 7 dias)
  if (createdAt >= sevenDaysAgo && customer.total_visits <= 1) {
    statuses.push('new');
  }

  // Em risco (sem visita há 30+ dias)
  if (lastSeen < thirtyDaysAgo) {
    statuses.push('at_risk');
  }

  // Promotor (aceita promoções)
  if (customer.marketing_optin) {
    statuses.push('promoter');
  }

  // Se não tem nenhum status especial, é ativo
  if (statuses.length === 0 || (statuses.length === 1 && statuses[0] === 'promoter')) {
    statuses.unshift('active');
  }

  return statuses;
}

function getPrimaryStatus(statuses: CustomerStatus[]): CustomerStatus {
  const priority: CustomerStatus[] = ['vip', 'at_risk', 'frequent', 'new', 'active', 'promoter'];
  return priority.find(s => statuses.includes(s)) || 'active';
}

const statusConfig: Record<CustomerStatus, { 
  icon: typeof Star; 
  label: string; 
  className: string;
  dotColor: string;
}> = {
  vip: {
    icon: Star,
    label: 'VIP',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dotColor: 'bg-amber-500',
  },
  frequent: {
    icon: TrendingUp,
    label: 'Frequente',
    className: 'bg-success/15 text-success border-success/30',
    dotColor: 'bg-success',
  },
  new: {
    icon: Zap,
    label: 'Novo',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    dotColor: 'bg-blue-500',
  },
  at_risk: {
    icon: AlertTriangle,
    label: 'Em risco',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
    dotColor: 'bg-destructive',
  },
  promoter: {
    icon: Mail,
    label: 'Promotor',
    className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    dotColor: 'bg-purple-500',
  },
  active: {
    icon: TrendingUp,
    label: 'Ativo',
    className: 'bg-primary/15 text-primary border-primary/30',
    dotColor: 'bg-primary',
  },
};

function CustomerRow({ 
  customer, 
  onViewProfile, 
  onSendPromotion,
  onRequestConsent,
  insightMessage,
}: { 
  customer: RestaurantCustomer; 
  onViewProfile: (id: string) => void;
  onSendPromotion: (customer: RestaurantCustomer) => void;
  onRequestConsent?: (customer: RestaurantCustomer) => void;
  insightMessage: string | null;
}) {
  const statuses = getCustomerStatuses(customer);
  const primaryStatus = getPrimaryStatus(statuses);
  const config = statusConfig[primaryStatus];
  const Icon = config.icon;

  const origin = customer.total_queue_visits > customer.total_reservation_visits 
    ? 'Fila' 
    : customer.total_reservation_visits > 0 
      ? 'Reserva' 
      : 'Fila';

  return (
    <Card 
      className="group hover:shadow-md transition-all duration-200 hover:border-primary/30 cursor-pointer"
      onClick={() => onViewProfile(customer.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-3 min-w-[200px] flex-1">
            <div className="relative">
              <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold">
                  {getInitials(customer.customer_name)}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background",
                config.dotColor
              )} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">
                  {customer.customer_name || 'Sem nome'}
                </p>
                {customer.vip && (
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {customer.customer_email}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="hidden md:flex items-center min-w-[120px]">
            <Badge variant="outline" className={cn("gap-1.5", config.className)}>
              <Icon className="w-3.5 h-3.5" />
              {config.label}
            </Badge>
          </div>

          {/* Insight - only show if has message */}
          {insightMessage && (
            <div className="hidden lg:block flex-1 min-w-[200px] max-w-[280px]">
              <p className="text-sm text-muted-foreground italic line-clamp-2">
                "{insightMessage}"
              </p>
            </div>
          )}

          {/* Last Visit */}
          <div className="hidden md:block min-w-[100px] text-right">
            <p className="text-sm font-medium">{getDaysAgo(customer.last_seen_at)}</p>
            <p className="text-xs text-muted-foreground">última visita</p>
          </div>

          {/* Visits */}
          <div className="hidden sm:block min-w-[80px] text-center">
            <p className="text-lg font-bold">{customer.total_visits}</p>
            <p className="text-xs text-muted-foreground">visitas</p>
          </div>

          {/* Origin */}
          <div className="hidden xl:block min-w-[70px]">
            <Badge variant="secondary" className="text-xs">
              {origin === 'Fila' ? '🎫' : '📅'} {origin}
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <TooltipProvider>
              {customer.marketing_optin ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendPromotion(customer);
                      }}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Enviar promoção</TooltipContent>
                </Tooltip>
              ) : onRequestConsent ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestConsent(customer);
                      }}
                    >
                      <MailPlus className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Solicitar consentimento</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-muted-foreground opacity-50 cursor-not-allowed"
                      disabled
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Não aceita promoções</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CustomerListPremium({ 
  customers, 
  onViewProfile, 
  onSendPromotion,
  onRequestConsent,
  getInsightMessage,
}: CustomerListPremiumProps) {
  if (customers.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum cliente encontrado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Os clientes aparecerão automaticamente ao usar a fila ou fazer reservas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {customers.map((customer) => (
        <CustomerRow
          key={customer.id}
          customer={customer}
          onViewProfile={onViewProfile}
          onSendPromotion={onSendPromotion}
          onRequestConsent={onRequestConsent}
          insightMessage={getInsightMessage(customer)}
        />
      ))}
    </div>
  );
}

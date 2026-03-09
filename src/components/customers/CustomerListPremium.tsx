import { Send, Star, TrendingUp, Zap, AlertTriangle, Mail, MailPlus, Clock, Cake, RefreshCw, ArrowLeftRight } from "lucide-react";
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

type CustomerStatus = 'frequent' | 'new' | 'vip' | 'at_risk' | 'promoter' | 'active' | 'recurrent';

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
  return `${days}d atrás`;
}

function getCustomerStatuses(customer: RestaurantCustomer): CustomerStatus[] {
  const statuses: CustomerStatus[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const lastSeen = new Date(customer.last_seen_at);
  const createdAt = new Date(customer.created_at);

  if (customer.vip || customer.total_visits >= 10) statuses.push('vip');
  if (customer.is_recurrent && !customer.vip) statuses.push('recurrent');
  if (createdAt >= sevenDaysAgo && customer.total_visits <= 1) statuses.push('new');
  if (lastSeen < thirtyDaysAgo) statuses.push('at_risk');
  if (customer.marketing_optin) statuses.push('promoter');
  if (statuses.length === 0 || (statuses.length === 1 && statuses[0] === 'promoter')) statuses.unshift('active');

  return statuses;
}

function getPrimaryStatus(statuses: CustomerStatus[]): CustomerStatus {
  const priority: CustomerStatus[] = ['vip', 'at_risk', 'recurrent', 'new', 'active', 'promoter'];
  return priority.find(s => statuses.includes(s)) || 'active';
}

const statusConfig: Record<CustomerStatus, { 
  icon: typeof Star; 
  label: string; 
  className: string;
  dotColor: string;
}> = {
  vip: { icon: Star, label: 'VIP', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', dotColor: 'bg-amber-500' },
  recurrent: { icon: RefreshCw, label: 'Recorrente', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dotColor: 'bg-emerald-500' },
  frequent: { icon: TrendingUp, label: 'Frequente', className: 'bg-success/15 text-success border-success/30', dotColor: 'bg-success' },
  new: { icon: Zap, label: 'Novo', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30', dotColor: 'bg-blue-500' },
  at_risk: { icon: AlertTriangle, label: 'Em risco', className: 'bg-destructive/15 text-destructive border-destructive/30', dotColor: 'bg-destructive' },
  promoter: { icon: Mail, label: 'Promotor', className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30', dotColor: 'bg-purple-500' },
  active: { icon: TrendingUp, label: 'Ativo', className: 'bg-primary/15 text-primary border-primary/30', dotColor: 'bg-primary' },
};

const originConfig: Record<string, { emoji: string; label: string; className: string }> = {
  queue: { emoji: '🎫', label: 'Fila', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  reservation: { emoji: '📅', label: 'Reserva', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  both: { emoji: '🔀', label: 'Fila + Reserva', className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  manual: { emoji: '✏️', label: 'Cliente cadastrado', className: 'bg-muted text-muted-foreground border-muted' },
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
  const origin = originConfig[customer.origin] || originConfig.manual;

  return (
    <Card 
      className="group hover:shadow-md transition-all duration-200 hover:border-primary/30 cursor-pointer"
      onClick={() => onViewProfile(customer.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-3 min-w-[180px] flex-1">
            <div className="relative">
              <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-sm">
                  {getInitials(customer.customer_name)}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                config.dotColor
              )} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-foreground truncate text-sm">
                  {customer.customer_name || 'Sem nome'}
                </p>
                {customer.vip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                {customer.is_birthday_soon && <span className="flex-shrink-0">🎂</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {customer.customer_email}
              </p>
            </div>
          </div>

          {/* Status + Origin Badges */}
          <div className="hidden md:flex items-center gap-1.5 min-w-[180px] flex-wrap">
            <Badge variant="outline" className={cn("gap-1 text-[11px]", config.className)}>
              <Icon className="w-3 h-3" />
              {config.label}
            </Badge>
            <Badge variant="outline" className={cn("gap-1 text-[10px]", origin.className)}>
              {origin.emoji} {origin.label}
            </Badge>
          </div>

          {/* Tags */}
          <div className="hidden lg:flex items-center gap-1 min-w-[120px] max-w-[200px] flex-wrap">
            {customer.tags.slice(0, 2).filter(t => 
              !['Veio pela fila', 'Veio pela reserva', 'Usa fila e reserva', 'VIP'].includes(t)
            ).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Insight */}
          {insightMessage && (
            <div className="hidden xl:block flex-1 min-w-[160px] max-w-[240px]">
              <p className="text-xs text-muted-foreground italic line-clamp-2">
                "{insightMessage}"
              </p>
            </div>
          )}

          {/* Last Visit */}
          <div className="hidden md:block min-w-[80px] text-right">
            <p className="text-sm font-medium">{getDaysAgo(customer.last_seen_at)}</p>
            <p className="text-[10px] text-muted-foreground">última visita</p>
          </div>

          {/* Visits */}
          <div className="hidden sm:block min-w-[60px] text-center">
            <p className="text-lg font-bold">{customer.total_visits}</p>
            <p className="text-[10px] text-muted-foreground">visitas</p>
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
                      className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={(e) => { e.stopPropagation(); onSendPromotion(customer); }}
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
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={(e) => { e.stopPropagation(); onRequestConsent(customer); }}
                    >
                      <MailPlus className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Solicitar consentimento</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground opacity-50 cursor-not-allowed" disabled>
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
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">{customers.length} cliente{customers.length !== 1 ? 's' : ''}</p>
      </div>
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

import { Send, Star, TrendingUp, Zap, AlertTriangle, Mail, MailPlus, RefreshCw, ChevronRight } from "lucide-react";
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

function getDaysSince(dateString: string) {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (24 * 60 * 60 * 1000));
}

type HealthLevel = 'active' | 'cooling' | 'at_risk';

function getHealth(customer: RestaurantCustomer): HealthLevel {
  const days = getDaysSince(customer.last_seen_at);
  if (days <= 14) return 'active';
  if (days <= 30) return 'cooling';
  return 'at_risk';
}

const healthConfig: Record<HealthLevel, { bar: string; ring: string; label: string }> = {
  active: { bar: 'bg-emerald-500', ring: 'ring-emerald-500/30', label: 'Cliente ativo' },
  cooling: { bar: 'bg-amber-500', ring: 'ring-amber-500/30', label: 'Esfriando — última visita 15-30 dias' },
  at_risk: { bar: 'bg-destructive', ring: 'ring-destructive/30', label: 'Em risco — sem visita há mais de 30 dias' },
};

// Palette of distinct, accessible avatar colors
const AVATAR_PALETTE = [
  'bg-gradient-to-br from-rose-500 to-rose-700',
  'bg-gradient-to-br from-orange-500 to-orange-700',
  'bg-gradient-to-br from-amber-500 to-amber-700',
  'bg-gradient-to-br from-emerald-500 to-emerald-700',
  'bg-gradient-to-br from-teal-500 to-teal-700',
  'bg-gradient-to-br from-sky-500 to-sky-700',
  'bg-gradient-to-br from-blue-500 to-blue-700',
  'bg-gradient-to-br from-indigo-500 to-indigo-700',
  'bg-gradient-to-br from-violet-500 to-violet-700',
  'bg-gradient-to-br from-fuchsia-500 to-fuchsia-700',
  'bg-gradient-to-br from-pink-500 to-pink-700',
  'bg-gradient-to-br from-lime-500 to-lime-700',
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getAvatarColor(customer: RestaurantCustomer): string {
  const seed = customer.customer_name || customer.customer_email || customer.id || '?';
  return AVATAR_PALETTE[hashString(seed) % AVATAR_PALETTE.length];
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
  index,
}: { 
  customer: RestaurantCustomer; 
  onViewProfile: (id: string) => void;
  onSendPromotion: (customer: RestaurantCustomer) => void;
  onRequestConsent?: (customer: RestaurantCustomer) => void;
  insightMessage: string | null;
  index: number;
}) {
  const statuses = getCustomerStatuses(customer);
  const primaryStatus = getPrimaryStatus(statuses);
  const config = statusConfig[primaryStatus];
  const Icon = config.icon;
  const origin = originConfig[customer.origin] || originConfig.manual;
  const health = getHealth(customer);
  const healthCfg = healthConfig[health];
  const avatarColor = getAvatarColor(customer);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer border bg-card animate-row-fade-in",
        "transition-all duration-200 hover:bg-muted/40 hover:shadow-md hover:border-foreground/15",
      )}
      style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }}
      onClick={() => onViewProfile(customer.id)}
    >
      {/* Health vertical bar */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "absolute left-0 top-0 bottom-0 w-1.5",
                healthCfg.bar,
                health === 'at_risk' && 'animate-pulse',
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="right">{healthCfg.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <CardContent className="pl-6 pr-4 py-5">
        <div className="flex items-center gap-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4 min-w-[200px] flex-1">
            <Avatar className={cn(
              "h-12 w-12 ring-2 ring-background shadow-md transition-transform duration-200 group-hover:scale-105",
              healthCfg.ring,
            )}>
              <AvatarFallback className={cn("text-white font-bold text-sm", avatarColor)}>
                {getInitials(customer.customer_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-foreground truncate text-[15px] leading-tight">
                  {customer.customer_name || 'Sem nome'}
                </p>
                {customer.vip && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                {customer.is_birthday_soon && <span className="flex-shrink-0">🎂</span>}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-muted-foreground/80 truncate mt-0.5 max-w-[260px]">
                      {customer.customer_email || customer.customer_phone || '—'}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>{customer.customer_email || customer.customer_phone || 'Sem contato'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Status + Origin Pills */}
          <div className="hidden md:flex items-center gap-1.5 min-w-[200px] flex-wrap">
            <Badge variant="outline" className={cn(
              "gap-1 rounded-full text-[10px] font-medium px-2.5 py-0.5 border",
              config.className,
            )}>
              <Icon className="w-3 h-3" />
              {config.label}
            </Badge>
            <Badge variant="outline" className={cn(
              "gap-1 rounded-full text-[10px] font-medium px-2.5 py-0.5 border",
              origin.className,
            )}>
              {origin.emoji} {origin.label}
            </Badge>
          </div>

          {/* Insight (italic, subdued) */}
          {insightMessage ? (
            <div className="hidden xl:block flex-1 min-w-[160px] max-w-[280px]">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs italic text-muted-foreground/70 line-clamp-2 leading-relaxed">
                      &ldquo;{insightMessage}&rdquo;
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{insightMessage}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <div className="hidden xl:block flex-1 min-w-[160px] max-w-[280px]" />
          )}

          {/* Last Visit — fixed column */}
          <div className="hidden md:block w-[110px] text-right shrink-0">
            <p className="text-sm font-semibold text-foreground tabular-nums">{getDaysAgo(customer.last_seen_at)}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium mt-0.5">última visita</p>
          </div>

          {/* Visits — fixed column */}
          <div className="hidden sm:flex flex-col items-center w-[70px] shrink-0">
            <p className="text-2xl font-black leading-none text-foreground tabular-nums">{customer.total_visits}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium mt-1">visitas</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto sm:ml-2">
            <TooltipProvider>
              {customer.marketing_optin ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-primary hover:text-primary hover:bg-primary/10"
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
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
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
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground opacity-50 cursor-not-allowed" disabled>
                      <Send className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Não aceita promoções</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
            {/* Reveal arrow on hover */}
            <ChevronRight className="h-5 w-5 text-muted-foreground/40 -ml-1 opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-orange-500" />
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
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{customers.length}</span> cliente{customers.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="space-y-2.5">
        {customers.map((customer, idx) => (
          <CustomerRow
            key={customer.id}
            customer={customer}
            onViewProfile={onViewProfile}
            onSendPromotion={onSendPromotion}
            onRequestConsent={onRequestConsent}
            insightMessage={getInsightMessage(customer)}
            index={idx}
          />
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { 
  X, 
  Star, 
  Mail, 
  Calendar, 
  Users,
  FileText, 
  Send, 
  Loader2,
  TrendingUp,
  AlertTriangle,
  Zap,
  Clock,
  Save,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase/client';
import { RestaurantCustomer } from '@/hooks/useRestaurantCustomers';
import { cn } from '@/lib/utils';
import { CustomerAIAnalysis } from './CustomerAIAnalysis';

type CustomerDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: RestaurantCustomer | null;
  onSendPromotion: (customer: RestaurantCustomer) => void;
  onCustomerUpdate?: () => void;
};

type HistoryItem = {
  id: string;
  type: 'queue' | 'reservation';
  date: string;
  status: string;
  party_size: number;
};

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDaysAgo(dateString: string) {
  const date = new Date(dateString);
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return `${days} dias atrás`;
}

function getStatusLabel(status: string): { label: string; className: string } {
  const configs: Record<string, { label: string; className: string }> = {
    seated: { label: 'Sentado', className: 'bg-success/15 text-success' },
    completed: { label: 'Concluído', className: 'bg-success/15 text-success' },
    confirmed: { label: 'Confirmado', className: 'bg-blue-500/15 text-blue-600' },
    waiting: { label: 'Aguardando', className: 'bg-yellow-500/15 text-yellow-600' },
    canceled: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive' },
    no_show: { label: 'Não compareceu', className: 'bg-destructive/15 text-destructive' },
  };
  return configs[status] || { label: status, className: 'bg-muted text-muted-foreground' };
}

export function CustomerDrawer({ 
  open, 
  onOpenChange, 
  customer, 
  onSendPromotion,
  onCustomerUpdate 
}: CustomerDrawerProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [updatingVip, setUpdatingVip] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load customer data when drawer opens
  useEffect(() => {
    if (open && customer) {
      // Load notes
      setNotes(customer.internal_notes || '');
      setNotesSaved(false);
      
      // Load history from edge function
      fetchHistory();
    }
  }, [open, customer?.id]);

  const fetchHistory = async () => {
    if (!customer) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-customer-history', {
        body: {
          restaurant_id: customer.restaurant_id,
          email: customer.customer_email,
          phone: customer.customer_phone
        }
      });

      if (error) throw error;

      // Combine queue and reservation history
      const combined: HistoryItem[] = [];
      
      if (data?.queue_history) {
        data.queue_history.forEach((q: any) => {
          combined.push({
            id: q.id,
            type: 'queue',
            date: q.created_at,
            status: q.status,
            party_size: q.party_size || 1
          });
        });
      }
      
      if (data?.reservation_history) {
        data.reservation_history.forEach((r: any) => {
          combined.push({
            id: r.id,
            type: 'reservation',
            date: r.reserved_for || r.created_at,
            status: r.status,
            party_size: r.party_size || 1
          });
        });
      }

      // Sort by date descending
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHistory(combined.slice(0, 10)); // Last 10
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!customer) return;
    
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('restaurant_customers')
        .update({ internal_notes: notes })
        .eq('id', customer.id);

      if (error) throw error;

      setNotesSaved(true);
      toast({ title: 'Nota salva', description: 'Observação atualizada com sucesso.' });
      onCustomerUpdate?.();
      
      // Reset saved indicator after 2s
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err) {
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível salvar a nota.', 
        variant: 'destructive' 
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleVip = async () => {
    if (!customer) return;
    
    setUpdatingVip(true);
    try {
      const newVipStatus = !customer.vip;
      const { error } = await supabase
        .from('restaurant_customers')
        .update({ vip: newVipStatus })
        .eq('id', customer.id);

      if (error) throw error;

      toast({ 
        title: newVipStatus ? '⭐ Cliente VIP' : 'VIP removido',
        description: newVipStatus 
          ? 'Cliente marcado como VIP.' 
          : 'Status VIP removido do cliente.'
      });
      onCustomerUpdate?.();
    } catch (err) {
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível atualizar o status VIP.', 
        variant: 'destructive' 
      });
    } finally {
      setUpdatingVip(false);
    }
  };

  if (!customer) return null;

  const lastSeen = new Date(customer.last_seen_at);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const createdAt = new Date(customer.created_at);
  
  const isVip = customer.vip || customer.total_visits >= 10;
  const isAtRisk = lastSeen < thirtyDaysAgo;
  const isNew = createdAt >= sevenDaysAgo && customer.total_visits <= 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 border-2 border-background shadow-md">
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-bold text-lg">
                {getInitials(customer.customer_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl flex items-center gap-2">
                {customer.customer_name || 'Sem nome'}
                {isVip && <Star className="w-5 h-5 text-amber-500 fill-amber-500" />}
              </SheetTitle>
              <p className="text-sm text-muted-foreground truncate">
                {customer.customer_email}
              </p>
              {customer.customer_phone && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {customer.customer_phone}
                </p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {isVip && (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1">
                <Star className="w-3 h-3" /> VIP
              </Badge>
            )}
            {isNew && (
              <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 gap-1">
                <Zap className="w-3 h-3" /> Novo
              </Badge>
            )}
            {customer.marketing_optin && (
              <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 gap-1">
                <Mail className="w-3 h-3" /> Opt-in marketing
              </Badge>
            )}
            {isAtRisk && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1">
                <AlertTriangle className="w-3 h-3" /> Em risco
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">Total de Visitas</span>
                </div>
                <p className="text-2xl font-bold">{customer.total_visits}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Última Visita</span>
                </div>
                <p className="text-sm font-semibold">{getDaysAgo(customer.last_seen_at)}</p>
              </div>
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Ações Rápidas</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleVip}
                  disabled={updatingVip}
                  className={cn(
                    "gap-2",
                    isVip && "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20"
                  )}
                >
                  {updatingVip ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Star className={cn("w-4 h-4", isVip && "fill-amber-500 text-amber-500")} />
                  )}
                  {isVip ? 'Remover VIP' : 'Marcar VIP'}
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSendPromotion(customer)}
                  disabled={!customer.marketing_optin}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  Enviar e-mail
                </Button>
              </div>
              {!customer.marketing_optin && (
                <p className="text-xs text-muted-foreground italic">
                  Cliente não aceita comunicações de marketing.
                </p>
              )}
            </div>

            <Separator />

            {/* AI Analysis Section */}
            <CustomerAIAnalysis
              customerId={customer.id}
              customerData={{
                name: customer.customer_name || 'Sem nome',
                vip_status: customer.vip,
                marketing_opt_in: customer.marketing_optin,
                created_at: customer.created_at,
                days_since_last_visit: Math.floor(
                  (Date.now() - new Date(customer.last_seen_at).getTime()) / (24 * 60 * 60 * 1000)
                ),
              }}
              metrics={{
                total_visits: customer.total_visits,
                queue_completed: customer.total_queue_visits,
                reservations_completed: customer.total_reservation_visits,
                canceled_count: 0,
                no_show_count: 0,
                show_rate: 100,
                avg_party_size: 4,
                preferred_time: '20:00',
                preferred_channel: customer.total_queue_visits > customer.total_reservation_visits ? 'queue' : 'reservation',
              }}
              historyData={{
                queue_count: history.filter(h => h.type === 'queue').length,
                reservation_count: history.filter(h => h.type === 'reservation').length,
              }}
            />

            <Separator />

            {/* Internal Notes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notas Internas
              </h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione observações sobre este cliente (visível apenas para o restaurante)..."
                className="min-h-[100px] resize-none"
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="gap-2"
              >
                {savingNotes ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : notesSaved ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {notesSaved ? 'Salvo!' : 'Salvar nota'}
              </Button>
            </div>

            <Separator />

            {/* History */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Histórico de Interações
              </h3>
              
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum histórico encontrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => {
                    const statusConfig = getStatusLabel(item.status);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs",
                          item.type === 'queue' 
                            ? "bg-primary/10 text-primary" 
                            : "bg-green-500/10 text-green-600"
                        )}>
                          {item.type === 'queue' ? '🎫' : '📅'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {item.type === 'queue' ? 'Fila' : 'Reserva'}
                            </span>
                            <Badge 
                              variant="secondary" 
                              className={cn("text-xs", statusConfig.className)}
                            >
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(item.date)} • {item.party_size} {item.party_size === 1 ? 'pessoa' : 'pessoas'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

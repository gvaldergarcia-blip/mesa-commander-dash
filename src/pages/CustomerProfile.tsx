import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Star, 
  CheckCircle2, 
  XCircle,
  Users,
  Send,
  Edit,
  MessageSquare,
  BarChart3,
  History,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { RESTAURANT_ID } from "@/config/current-restaurant";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSendPromotion } from "@/hooks/useSendPromotion";
import { SendPromotionDialog } from "@/components/customers/SendPromotionDialog";

type CustomerStatus = 'vip' | 'frequent' | 'new' | 'at_risk' | 'active';

type CustomerData = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  total_visits: number;
  queue_completed: number;
  reservations_completed: number;
  last_visit_at?: string;
  first_visit_at?: string;
  created_at: string;
  vip_status: boolean;
  marketing_opt_in: boolean;
  status: CustomerStatus;
  days_since_last_visit?: number;
  notes?: string;
  avg_party_size?: number;
  preferred_time?: string;
};

type VisitHistory = {
  id: string;
  type: 'queue' | 'reservation';
  date: string;
  party_size: number;
  status: string;
  wait_time?: number;
};

type TimelineEvent = {
  id: string;
  type: 'queue_completed' | 'reservation_completed' | 'queue_canceled' | 'reservation_canceled' | 'promotion_sent';
  date: string;
  description: string;
  icon: typeof Star;
  color: string;
};

const statusConfig: Record<CustomerStatus, { label: string; className: string; icon: typeof Star }> = {
  vip: {
    label: 'VIP',
    className: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    icon: Star,
  },
  frequent: {
    label: 'Frequente',
    className: 'bg-success/15 text-success border-success/30',
    icon: TrendingUp,
  },
  new: {
    label: 'Novo',
    className: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
    icon: Users,
  },
  at_risk: {
    label: 'Em risco',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
    icon: Clock,
  },
  active: {
    label: 'Ativo',
    className: 'bg-primary/15 text-primary border-primary/30',
    icon: CheckCircle2,
  },
};

export default function CustomerProfile() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sendPromotion, sending: sendingPromotion } = useSendPromotion();
  
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [history, setHistory] = useState<VisitHistory[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [togglingVip, setTogglingVip] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);

  useEffect(() => {
    if (customerId) {
      fetchCustomerData(customerId);
    }
  }, [customerId]);

  const fetchCustomerData = async (id: string) => {
    try {
      setLoading(true);

      // Buscar dados do cliente
      // O customerId pode vir de restaurant_customers (CRM) ou customers (global)
      let customerData = null;
      
      // 1. Tentar primeiro na tabela restaurant_customers (fonte principal da lista)
      const { data: restaurantCustomer } = await supabase
        .from('restaurant_customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (restaurantCustomer) {
        // Mapear dados de restaurant_customers para o formato esperado
        customerData = {
          id: restaurantCustomer.id,
          name: restaurantCustomer.customer_name || 'Sem nome',
          phone: restaurantCustomer.customer_phone,
          email: restaurantCustomer.customer_email,
          total_visits: restaurantCustomer.total_visits || 0,
          queue_completed: restaurantCustomer.total_queue_visits || 0,
          reservations_completed: restaurantCustomer.total_reservation_visits || 0,
          last_visit_date: restaurantCustomer.last_seen_at,
          first_visit_at: restaurantCustomer.created_at,
          created_at: restaurantCustomer.created_at,
          vip_status: restaurantCustomer.vip || false,
          marketing_opt_in: restaurantCustomer.marketing_optin || false,
          notes: null,
        };
      } else {
        // 2. Tentar na tabela customers (global) por ID
        const { data: byId } = await supabase
          .from('customers')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        
        if (byId) {
          customerData = byId;
        } else {
          // 3. Tentar por telefone
          const { data: byPhone } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', id)
            .maybeSingle();
          
          if (byPhone) {
            customerData = byPhone;
          }
        }
      }

      if (!customerData) {
        setCustomer(null);
        return;
      }

      // Calcular status
      const lastVisit = customerData.last_visit_date ? new Date(customerData.last_visit_date) : null;
      const createdAt = new Date(customerData.created_at);
      const now = new Date();
      const daysSinceLastVisit = lastVisit 
        ? Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const totalVisits = customerData.total_visits || 0;

      let status: CustomerStatus = 'active';
      if (customerData.vip_status || totalVisits >= 10) {
        status = 'vip';
      } else if (daysSinceLastVisit && daysSinceLastVisit > 30) {
        status = 'at_risk';
      } else if (totalVisits >= 3) {
        status = 'frequent';
      } else if (daysSinceCreated <= 7 && totalVisits <= 1) {
        status = 'new';
      }

      setCustomer({
        id: customerData.id,
        name: customerData.name || 'Sem nome',
        phone: customerData.phone || '',
        email: customerData.email,
        total_visits: totalVisits,
        queue_completed: customerData.queue_completed || 0,
        reservations_completed: customerData.reservations_completed || 0,
        last_visit_at: customerData.last_visit_date,
        first_visit_at: customerData.first_visit_at || customerData.created_at,
        created_at: customerData.created_at,
        vip_status: customerData.vip_status || totalVisits >= 10,
        marketing_opt_in: customerData.marketing_opt_in || false,
        status,
        days_since_last_visit: daysSinceLastVisit ?? undefined,
        notes: customerData.notes,
      });

      setNotes(customerData.notes || '');

      // Buscar histórico de visitas via Edge Function
      await fetchVisitHistory(customerData.id, customerData.email, customerData.phone);
      
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitHistory = async (customerId: string, email?: string, phone?: string | null) => {
    try {
      console.log('[CustomerProfile] Fetching history via Edge Function:', { customerId, email, phone });
      
      // Chamar Edge Function que busca dados do schema mesaclik
      const { data, error } = await supabase.functions.invoke('get-customer-history', {
        body: {
          customer_id: customerId,
          restaurant_id: RESTAURANT_ID,
          email: email || '',
          phone: phone && phone !== '—' ? phone : ''
        }
      });

      if (error) {
        console.error('[CustomerProfile] Edge function error:', error);
        return;
      }

      console.log('[CustomerProfile] History data received:', {
        queue: data?.queue_history?.length || 0,
        reservation: data?.reservation_history?.length || 0,
        promotion: data?.promotion_history?.length || 0
      });

      // Mapear dados para o formato esperado
      const historyItems: VisitHistory[] = [
        ...(data?.queue_history || []).map((q: any) => ({
          id: q.id,
          type: 'queue' as const,
          date: q.seated_at || q.created_at,
          party_size: q.party_size,
          status: q.status,
          wait_time: q.wait_time,
        })),
        ...(data?.reservation_history || []).map((r: any) => ({
          id: r.id,
          type: 'reservation' as const,
          date: r.reserved_for || r.created_at,
          party_size: r.party_size,
          status: r.status,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistory(historyItems);

      // Criar timeline de eventos (incluindo promoções)
      const allEvents = [
        ...historyItems.slice(0, 15).map(item => ({
          id: item.id,
          type: item.type === 'queue' 
            ? (item.status === 'seated' ? 'queue_completed' : 'queue_canceled')
            : (item.status === 'completed' ? 'reservation_completed' : 'reservation_canceled') as TimelineEvent['type'],
          date: item.date,
          description: item.type === 'queue'
            ? `Fila ${item.status === 'seated' ? 'concluída' : item.status === 'canceled' ? 'cancelada' : 'não compareceu'} • ${item.party_size} pessoa(s)`
            : `Reserva ${item.status === 'completed' ? 'concluída' : item.status === 'canceled' ? 'cancelada' : item.status} • ${item.party_size} pessoa(s)`,
          icon: item.status === 'seated' || item.status === 'completed' ? CheckCircle2 : XCircle,
          color: item.status === 'seated' || item.status === 'completed' ? 'text-success' : 'text-destructive',
        })),
        ...(data?.promotion_history || []).slice(0, 5).map((p: any) => ({
          id: p.id,
          type: 'promotion_sent' as TimelineEvent['type'],
          date: p.created_at,
          description: `Promoção enviada: ${p.subject}`,
          icon: Send,
          color: 'text-primary',
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTimeline(allEvents.slice(0, 15));

    } catch (error) {
      console.error('[CustomerProfile] Erro ao carregar histórico:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Calcular comportamento
  const behaviorStats = useMemo(() => {
    if (history.length === 0) return null;

    const completedVisits = history.filter(h => h.status === 'seated' || h.status === 'completed');
    const avgPartySize = completedVisits.length > 0
      ? Math.round(completedVisits.reduce((acc, h) => acc + h.party_size, 0) / completedVisits.length)
      : 0;

    // Horários mais frequentes
    const hours = completedVisits.map(h => new Date(h.date).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const mostFrequentHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const preferredTime = mostFrequentHour 
      ? `${mostFrequentHour[0]}:00 - ${parseInt(mostFrequentHour[0]) + 1}:00`
      : 'N/A';

    // Canal mais usado
    const queueCount = history.filter(h => h.type === 'queue').length;
    const reservationCount = history.filter(h => h.type === 'reservation').length;
    const preferredChannel = queueCount >= reservationCount ? 'Fila' : 'Reserva';

    // Taxa de comparecimento
    const showRate = history.length > 0
      ? Math.round((completedVisits.length / history.length) * 100)
      : 100;

    return {
      avgPartySize,
      preferredTime,
      preferredChannel,
      showRate,
    };
  }, [history]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-40 bg-muted rounded-lg"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="text-center mt-8">
          <p className="text-muted-foreground">Cliente não encontrado</p>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[customer.status].icon;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/customers')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Edit className="w-4 h-4" />
            Editar
          </Button>
          {customer.marketing_opt_in && (
            <Button size="sm" className="gap-2">
              <Send className="w-4 h-4" />
              Criar promoção
            </Button>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-20 h-20 border-4 border-background shadow-lg">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-2xl font-bold">
                {getInitials(customer.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{customer.name}</h1>
                <Badge variant="outline" className={cn("gap-1.5", statusConfig[customer.status].className)}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusConfig[customer.status].label}
                </Badge>
                {customer.marketing_opt_in && (
                  <Badge variant="secondary" className="gap-1">
                    <Mail className="w-3 h-3" />
                    Promotor
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {customer.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    <span>{customer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>Cliente desde {formatDate(customer.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customer.total_visits}</p>
                <p className="text-xs text-muted-foreground">Visitas totais</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-success/10 rounded-lg">
                <Users className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customer.queue_completed}</p>
                <p className="text-xs text-muted-foreground">Filas concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent/10 rounded-lg">
                <Calendar className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customer.reservations_completed}</p>
                <p className="text-xs text-muted-foreground">Reservas concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-muted rounded-lg">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {customer.days_since_last_visit === 0 
                    ? 'Hoje' 
                    : `${customer.days_since_last_visit}d`}
                </p>
                <p className="text-xs text-muted-foreground">Última visita</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-background">
            <History className="w-4 h-4" />
            Linha do tempo
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-2 data-[state=active]:bg-background">
            <BarChart3 className="w-4 h-4" />
            Comportamento
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2 data-[state=active]:bg-background">
            <MessageSquare className="w-4 h-4" />
            Ações
          </TabsTrigger>
        </TabsList>

        {/* Tab: Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Interações</CardTitle>
              <CardDescription>
                Entradas na fila, reservas e promoções recebidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma interação registrada
                </div>
              ) : (
                <div className="space-y-4">
                  {timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn("p-2 rounded-full bg-muted", event.color)}>
                          <event.icon className="w-4 h-4" />
                        </div>
                        {index < timeline.length - 1 && (
                          <div className="w-px h-full bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium">{event.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(event.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Behavior */}
        <TabsContent value="behavior" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Padrões de Comportamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {behaviorStats ? (
                  <>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Tamanho médio de grupo</span>
                      <span className="font-semibold">{behaviorStats.avgPartySize} pessoas</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Horário preferido</span>
                      <span className="font-semibold">{behaviorStats.preferredTime}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Canal mais usado</span>
                      <Badge variant="secondary">{behaviorStats.preferredChannel}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Taxa de comparecimento</span>
                      <span className={cn(
                        "font-semibold",
                        behaviorStats.showRate >= 80 ? "text-success" : "text-warning"
                      )}>
                        {behaviorStats.showRate}%
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    Dados insuficientes para análise
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferências de Marketing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  {customer.marketing_opt_in ? (
                    <>
                      <div className="p-3 bg-success/10 rounded-lg">
                        <CheckCircle2 className="w-6 h-6 text-success" />
                      </div>
                      <div>
                        <p className="font-semibold">Aceita receber promoções</p>
                        <p className="text-sm text-muted-foreground">
                          Cliente autorizou comunicações de marketing
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-muted rounded-lg">
                        <XCircle className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">Não aceita promoções</p>
                        <p className="text-sm text-muted-foreground">
                          Cliente não autorizou comunicações
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Actions */}
        <TabsContent value="actions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start gap-2" 
                  variant="outline"
                  disabled={!customer.marketing_opt_in || !customer.email}
                  onClick={() => setPromotionDialogOpen(true)}
                >
                  <Send className="w-4 h-4" />
                  Enviar promoção
                  {!customer.marketing_opt_in && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Sem opt-in
                    </Badge>
                  )}
                  {customer.marketing_opt_in && !customer.email && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Sem email
                    </Badge>
                  )}
                </Button>
                <Button 
                  className="w-full justify-start gap-2" 
                  variant="outline"
                  disabled={togglingVip}
                  onClick={handleToggleVip}
                >
                  {togglingVip ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Star className={cn("w-4 h-4", customer.vip_status && "fill-amber-500 text-amber-500")} />
                  )}
                  {customer.vip_status ? 'Remover status VIP' : 'Marcar como VIP'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Observações Internas</CardTitle>
                <CardDescription>
                  Notas visíveis apenas para a equipe do restaurante
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Adicione observações sobre este cliente..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button 
                  className="mt-3" 
                  size="sm"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                >
                  {savingNotes ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Salvar observações
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Promotion Dialog */}
      {customer && customer.email && (
        <SendPromotionDialog
          open={promotionDialogOpen}
          onOpenChange={setPromotionDialogOpen}
          customer={{
            id: customer.id,
            customer_email: customer.email,
            customer_name: customer.name,
            customer_phone: customer.phone,
            marketing_optin: customer.marketing_opt_in,
            total_visits: customer.total_visits,
            vip: customer.vip_status,
          } as any}
          onSubmit={async (data) => {
            await sendPromotion({
              to_email: customer.email!,
              to_name: customer.name,
              subject: data.subject,
              message: data.message,
              coupon_code: data.couponCode,
              expires_at: data.expiresAt,
              cta_text: data.ctaText,
              cta_url: data.ctaUrl,
              image_url: data.imageUrl,
            });
            setPromotionDialogOpen(false);
          }}
          isSubmitting={sendingPromotion}
        />
      )}
    </div>
  );

  // Handler para toggle VIP
  async function handleToggleVip() {
    if (!customer) return;
    
    setTogglingVip(true);
    try {
      const newVipStatus = !customer.vip_status;
      
      const { error } = await supabase
        .from('customers')
        .update({ vip_status: newVipStatus })
        .eq('id', customer.id);

      if (error) throw error;

      setCustomer(prev => prev ? { ...prev, vip_status: newVipStatus, status: newVipStatus ? 'vip' : prev.status } : null);
      
      toast({
        title: newVipStatus ? '⭐ Cliente marcado como VIP' : 'Status VIP removido',
        description: newVipStatus 
          ? `${customer.name} agora é um cliente VIP` 
          : `${customer.name} não é mais VIP`,
      });
    } catch (error) {
      console.error('Erro ao alterar status VIP:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status VIP',
        variant: 'destructive',
      });
    } finally {
      setTogglingVip(false);
    }
  }

  // Handler para salvar notas
  async function handleSaveNotes() {
    if (!customer) return;
    
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ notes })
        .eq('id', customer.id);

      if (error) throw error;

      toast({
        title: '✓ Observações salvas',
        description: 'As notas foram atualizadas com sucesso',
      });
    } catch (error) {
      console.error('Erro ao salvar notas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as observações',
        variant: 'destructive',
      });
    } finally {
      setSavingNotes(false);
    }
  }
}

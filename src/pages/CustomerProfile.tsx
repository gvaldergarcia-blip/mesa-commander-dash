import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Mail, Calendar, TrendingUp, Clock, Star,
  CheckCircle2, XCircle, Users, Send, Edit, MessageSquare,
  BarChart3, History, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSendPromotion } from "@/hooks/useSendPromotion";
import { SendPromotionDialog } from "@/components/customers/SendPromotionDialog";
import { CustomerAlerts } from "@/components/customers/CustomerAlerts";
import { CustomerScore } from "@/components/customers/CustomerScoreCard";
import { CustomerActivityChart } from "@/components/customers/CustomerActivityChart";
import { CustomerTrend } from "@/components/customers/CustomerTrend";
import { CustomerTimeline } from "@/components/customers/CustomerTimeline";
import { CustomerInsights } from "@/components/customers/CustomerInsightsCard";
import { CustomerAIAnalysis } from "@/components/customers/CustomerAIAnalysis";
import { CustomerLoyaltyCard } from "@/components/customers/CustomerLoyaltyCard";

type CustomerStatus = 'vip' | 'frequent' | 'new' | 'at_risk' | 'active';

const statusConfig: Record<CustomerStatus, { label: string; className: string; icon: typeof Star }> = {
  vip: { label: 'VIP', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Star },
  frequent: { label: 'Frequente', className: 'bg-success/15 text-success border-success/30', icon: TrendingUp },
  new: { label: 'Novo', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: Users },
  at_risk: { label: 'Em risco', className: 'bg-destructive/15 text-destructive border-destructive/30', icon: Clock },
  active: { label: 'Ativo', className: 'bg-primary/15 text-primary border-primary/30', icon: CheckCircle2 },
};

export default function CustomerProfile() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { restaurantId, userRole } = useRestaurant();
  const { sendPromotion, sending: sendingPromotion } = useSendPromotion();
  const isAdmin = userRole === 'admin';

  const [customer, setCustomer] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [togglingVip, setTogglingVip] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');

  useEffect(() => {
    if (customerId) fetchCustomerData(customerId);
  }, [customerId]);

  const fetchCustomerData = async (id: string) => {
    try {
      setLoading(true);

      // Get customer from restaurant_customers first
      const { data: restaurantCustomer } = await supabase
        .from('restaurant_customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      let customerInfo: any = null;
      if (restaurantCustomer) {
        customerInfo = {
          id: restaurantCustomer.id,
          name: restaurantCustomer.customer_name || 'Sem nome',
          phone: restaurantCustomer.customer_phone,
          email: restaurantCustomer.customer_email,
          total_visits: restaurantCustomer.total_visits || 0,
          queue_completed: restaurantCustomer.total_queue_visits || 0,
          reservations_completed: restaurantCustomer.total_reservation_visits || 0,
          last_visit_date: restaurantCustomer.last_seen_at,
          created_at: restaurantCustomer.created_at,
          vip_status: restaurantCustomer.vip || false,
          marketing_opt_in: restaurantCustomer.marketing_optin || false,
          notes: restaurantCustomer.internal_notes,
        };
      } else {
        // Fallback to customers table
        const { data: byId } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
        if (byId) customerInfo = byId;
      }

      if (!customerInfo) {
        setCustomer(null);
        return;
      }

      // Calculate status
      const lastVisit = customerInfo.last_visit_date ? new Date(customerInfo.last_visit_date) : null;
      const now = new Date();
      const daysSinceLastVisit = lastVisit
        ? Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const daysSinceCreated = Math.floor((now.getTime() - new Date(customerInfo.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const totalVisits = customerInfo.total_visits || 0;

      let status: CustomerStatus = 'active';
      if (customerInfo.vip_status || totalVisits >= 10) status = 'vip';
      else if (daysSinceLastVisit && daysSinceLastVisit > 30) status = 'at_risk';
      else if (totalVisits >= 3) status = 'frequent';
      else if (daysSinceCreated <= 7 && totalVisits <= 1) status = 'new';

      const finalCustomer = {
        ...customerInfo,
        status,
        days_since_last_visit: daysSinceLastVisit,
        vip_status: customerInfo.vip_status || totalVisits >= 10,
      };
      setCustomer(finalCustomer);
      setNotes(customerInfo.notes || '');

      // Fetch history via edge function
      const { data, error } = await supabase.functions.invoke('get-customer-history', {
        body: {
          customer_id: id,
          restaurant_id: restaurantId || '',
          email: customerInfo.email || '',
          phone: customerInfo.phone && customerInfo.phone !== '—' ? customerInfo.phone : '',
        },
      });
      if (!error && data) {
        setHistoryData(data);
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build timeline events from history data
  const timelineEvents = useMemo(() => {
    if (!historyData) return [];
    const events: any[] = [];

    (historyData.queue_history || []).forEach((q: any) => {
      events.push({
        id: q.id, type: 'queue', status: q.status,
        date: q.seated_at || q.created_at, party_size: q.party_size,
        wait_time: q.wait_time, cancel_actor: q.cancel_actor,
      });
    });

    (historyData.reservation_history || []).forEach((r: any) => {
      events.push({
        id: r.id, type: 'reservation', status: r.status,
        date: r.reserved_for || r.created_at, party_size: r.party_size,
        cancel_actor: r.cancel_actor,
      });
    });

    (historyData.promotion_history || []).forEach((p: any) => {
      events.push({
        id: p.id, type: 'promotion', status: 'sent',
        date: p.created_at, subject: p.subject, source: p.source,
      });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [historyData]);

  const metrics = historyData?.metrics;
  const alerts = historyData?.alerts || [];
  const score = historyData?.score;
  const trend = historyData?.trend;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-40 bg-muted rounded-lg" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <div className="text-center mt-8">
          <p className="text-muted-foreground">Cliente não encontrado</p>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[customer.status as CustomerStatus].icon;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/customers')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar para Clientes
        </Button>
        <div className="flex items-center gap-2">
          {customer.marketing_opt_in && customer.email && (
            <Button size="sm" className="gap-2" onClick={() => setPromotionDialogOpen(true)}>
              <Send className="w-4 h-4" /> Criar promoção
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      <CustomerAlerts
        alerts={alerts}
        onSendPromotion={() => setPromotionDialogOpen(true)}
        onViewEvents={() => setActiveTab('timeline')}
      />

      {/* Profile Card + Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
            <div className="flex items-start gap-5">
              <Avatar className="w-18 h-18 border-4 border-background shadow-lg">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xl font-bold">
                  {getInitials(customer.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h1 className="text-xl font-bold">{customer.name}</h1>
                  <Badge variant="outline" className={cn("gap-1", statusConfig[customer.status as CustomerStatus].className)}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig[customer.status as CustomerStatus].label}
                  </Badge>
                  {trend && <CustomerTrend {...trend} />}
                  {customer.marketing_opt_in && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Mail className="w-3 h-3" /> Promotor
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {customer.phone && <span>{customer.phone}</span>}
                  {customer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {customer.email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Desde {formatDate(customer.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Score */}
        {isAdmin && score && (
          <CustomerScore score={score.value} tags={score.tags} />
        )}
      </div>

      {/* Stats Grid - uses edge function metrics as single source of truth */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: Star, label: 'Visitas totais', value: metrics?.total_visits ?? customer.total_visits, color: 'bg-primary/10 text-primary' },
          { icon: Users, label: 'Filas concluídas', value: metrics?.queue_completed ?? customer.queue_completed, color: 'bg-success/10 text-success' },
          { icon: Calendar, label: 'Reservas concluídas', value: metrics?.reservations_completed ?? customer.reservations_completed, color: 'bg-accent/10 text-accent' },
          { icon: Clock, label: 'Última visita', value: (metrics?.days_since_last_visit ?? customer.days_since_last_visit) === 0 ? 'Hoje' : (metrics?.days_since_last_visit ?? customer.days_since_last_visit) != null ? `${metrics?.days_since_last_visit ?? customer.days_since_last_visit}d` : 'N/A', color: 'bg-muted text-muted-foreground' },
          { icon: CheckCircle2, label: 'Comparecimento', value: metrics?.show_rate != null ? `${metrics.show_rate}%` : 'N/A', color: metrics?.show_rate >= 80 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning' },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2.5">
                <div className={cn("p-2 rounded-lg", stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loyalty Card */}
      {restaurantId && customerId && (
        <CustomerLoyaltyCard customerId={customerId} restaurantId={restaurantId} marketingOptIn={customer.marketing_opt_in} />
      )}

      {/* AI Analysis - always visible for admins */}
      {isAdmin && (
        <CustomerAIAnalysis
          customerId={customer.id}
          customerData={{
            name: customer.name,
            vip_status: customer.vip_status,
            marketing_opt_in: customer.marketing_opt_in,
            created_at: customer.created_at,
            days_since_last_visit: metrics?.days_since_last_visit ?? customer.days_since_last_visit,
          }}
          metrics={{
            total_visits: metrics?.total_visits ?? customer.total_visits ?? 0,
            queue_completed: metrics?.queue_completed ?? customer.queue_completed ?? 0,
            reservations_completed: metrics?.reservations_completed ?? customer.reservations_completed ?? 0,
            canceled_count: metrics?.canceled_count || 0,
            no_show_count: metrics?.no_show_count || 0,
            show_rate: metrics?.show_rate,
            avg_party_size: metrics?.avg_party_size,
            preferred_time: metrics?.preferred_time,
            preferred_channel: metrics?.preferred_channel,
            promotions_sent: metrics?.promotions_sent || 0,
          }}
          historyData={{
            queue_count: historyData?.queue_history?.length || 0,
            reservation_count: historyData?.reservation_history?.length || 0,
          }}
        />
      )}

      {/* Activity Chart - Admin only */}
      {isAdmin && metrics?.monthly_evolution && (
        <CustomerActivityChart monthlyEvolution={metrics.monthly_evolution} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-background">
            <History className="w-4 h-4" /> Linha do tempo
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="insights" className="gap-2 data-[state=active]:bg-background">
              <BarChart3 className="w-4 h-4" /> Insights
            </TabsTrigger>
          )}
          <TabsTrigger value="actions" className="gap-2 data-[state=active]:bg-background">
            <MessageSquare className="w-4 h-4" /> Ações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <CustomerTimeline events={timelineEvents} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="insights">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CustomerInsights
                preferredTime={metrics?.preferred_time}
                preferredDay={metrics?.preferred_day}
                avgPartySize={metrics?.avg_party_size || 0}
                preferredChannel={metrics?.preferred_channel || 'queue'}
                showRate={metrics?.show_rate || 100}
                customerAvgWait={metrics?.customer_avg_wait_time}
                restaurantAvgWait={metrics?.restaurant_avg_wait_time || 0}
                daysSinceLastVisit={metrics?.days_since_last_visit}
                marketingOptIn={customer.marketing_opt_in}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comparação de Espera</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {metrics?.customer_avg_wait_time ? (
                    <>
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Espera média do cliente</span>
                        <span className="font-semibold">{metrics.customer_avg_wait_time} min</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Espera média do restaurante</span>
                        <span className="font-semibold">{metrics.restaurant_avg_wait_time} min</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg border">
                        <span className="text-sm text-muted-foreground">Diferença</span>
                        <Badge variant="outline" className={cn(
                          metrics.customer_avg_wait_time > metrics.restaurant_avg_wait_time * 1.3
                            ? 'bg-destructive/15 text-destructive border-destructive/30'
                            : 'bg-success/15 text-success border-success/30'
                        )}>
                          {metrics.customer_avg_wait_time > metrics.restaurant_avg_wait_time
                            ? `+${metrics.customer_avg_wait_time - metrics.restaurant_avg_wait_time} min acima`
                            : `${metrics.restaurant_avg_wait_time - metrics.customer_avg_wait_time} min abaixo`
                          }
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Sem dados de espera disponíveis
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        <TabsContent value="actions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Ações Rápidas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                  disabled={!customer.marketing_opt_in || !customer.email}
                  onClick={() => setPromotionDialogOpen(true)}
                >
                  <Send className="w-4 h-4" /> Enviar promoção
                  {!customer.marketing_opt_in && <Badge variant="secondary" className="ml-auto text-xs">Sem opt-in</Badge>}
                </Button>
                <Button
                  className="w-full justify-start gap-2"
                  variant="outline"
                  disabled={togglingVip}
                  onClick={handleToggleVip}
                >
                  {togglingVip ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    <Star className={cn("w-4 h-4", customer.vip_status && "fill-amber-500 text-amber-500")} />}
                  {customer.vip_status ? 'Remover status VIP' : 'Marcar como VIP'}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações Internas</CardTitle>
                <CardDescription>Notas visíveis apenas para a equipe</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Adicione observações..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button className="mt-3" size="sm" disabled={savingNotes} onClick={handleSaveNotes}>
                  {savingNotes && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Salvar observações
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Promotion Dialog */}
      {customer?.email && (
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

  async function handleToggleVip() {
    if (!customer) return;
    setTogglingVip(true);
    try {
      const newVip = !customer.vip_status;
      const { error } = await supabase.from('customers').update({ vip_status: newVip }).eq('id', customer.id);
      if (error) throw error;
      setCustomer((prev: any) => prev ? { ...prev, vip_status: newVip, status: newVip ? 'vip' : prev.status } : null);
      toast({ title: newVip ? '⭐ Cliente marcado como VIP' : 'Status VIP removido' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível alterar o status VIP', variant: 'destructive' });
    } finally {
      setTogglingVip(false);
    }
  }

  async function handleSaveNotes() {
    if (!customer) return;
    setSavingNotes(true);
    try {
      const { error: rcError } = await supabase.from('restaurant_customers').update({ internal_notes: notes }).eq('id', customer.id);
      if (rcError) {
        const { error: custError } = await supabase.from('customers').update({ notes }).eq('id', customer.id);
        if (custError) throw custError;
      }
      toast({ title: '✓ Observações salvas' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar', variant: 'destructive' });
    } finally {
      setSavingNotes(false);
    }
  }
}

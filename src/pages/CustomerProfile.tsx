import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Mail, Calendar, TrendingUp, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase/client";
import { CustomerStatusBadge } from "@/components/customers/CustomerStatusBadge";
import { CustomerEnhanced } from "@/hooks/useCustomersEnhanced";

type VisitHistory = {
  id: string;
  type: 'queue' | 'reservation';
  date: string;
  party_size: number;
  status: string;
};

export default function CustomerProfile() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerEnhanced | null>(null);
  const [history, setHistory] = useState<VisitHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customerId) {
      fetchCustomerData(customerId);
    }
  }, [customerId]);

  const fetchCustomerData = async (phone: string) => {
    try {
      setLoading(true);

      // Buscar dados do cliente
      const { data: customerData, error: customerError } = await supabase
        .schema('mesaclik')
        .from('v_customers')
        .select('*')
        .eq('phone', phone)
        .single();

      if (customerError) throw customerError;

      // Contar fila e reservas concluídas
      const { count: queueCount } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('phone', phone)
        .eq('status', 'seated');

      const { count: reservationCount } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('phone', phone)
        .eq('status', 'completed');

      const queueCompleted = queueCount || 0;
      const reservationsCompleted = reservationCount || 0;
      const visitsCompleted = queueCompleted + reservationsCompleted;
      const isVip = visitsCompleted >= 10;

      // Calcular status
      let status: CustomerEnhanced['status'] = 'active';
      const lastVisit = customerData.last_visit_at ? new Date(customerData.last_visit_at) : null;
      const firstVisit = new Date(customerData.created_at);
      const now = new Date();
      let daysSinceLastVisit: number | undefined;

      if (lastVisit) {
        daysSinceLastVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
        if (isVip) {
          status = 'vip';
        } else if (daysSinceLastVisit > 30) {
          status = 'inactive';
        } else if (Math.floor((now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24)) <= 7) {
          status = 'new';
        }
      }

      setCustomer({
        id: phone,
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        total_visits: customerData.total_visits,
        queue_completed: queueCompleted,
        reservations_completed: reservationsCompleted,
        visits_completed: visitsCompleted,
        last_visit_at: customerData.last_visit_at,
        first_visit_at: customerData.created_at,
        created_at: customerData.created_at,
        vip_status: isVip,
        marketing_opt_in: customerData.marketing_opt_in,
        status,
        days_since_last_visit: daysSinceLastVisit,
      });

      // Buscar histórico de visitas (fila seated + reservas completed)
      const { data: queueHistory } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('id, seated_at, party_size, status')
        .eq('phone', phone)
        .eq('status', 'seated')
        .order('seated_at', { ascending: false });

      const { data: reservationHistory } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .select('id, completed_at, party_size, status')
        .eq('phone', phone)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      const combinedHistory: VisitHistory[] = [
        ...(queueHistory || []).map(q => ({
          id: q.id,
          type: 'queue' as const,
          date: q.seated_at || '',
          party_size: q.party_size,
          status: q.status,
        })),
        ...(reservationHistory || []).map(r => ({
          id: r.id,
          type: 'reservation' as const,
          date: r.completed_at || '',
          party_size: r.party_size,
          status: r.status,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistory(combinedHistory);
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Clientes
        </Button>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-24 h-24">
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                {getInitials(customer.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{customer.name}</h1>
                <CustomerStatusBadge status={customer.status} />
              </div>
              <div className="flex flex-col gap-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{customer.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Star className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customer.visits_completed}</p>
                <p className="text-sm text-muted-foreground">Visitas concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customer.queue_completed}</p>
                <p className="text-sm text-muted-foreground">Fila concluída</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-success/10 rounded-lg">
                <Calendar className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customer.reservations_completed}</p>
                <p className="text-sm text-muted-foreground">Reservas concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-muted rounded-lg">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {customer.days_since_last_visit !== undefined 
                    ? customer.days_since_last_visit === 0 
                      ? 'Hoje' 
                      : `${customer.days_since_last_visit}d`
                    : 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">Última visita</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visit History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Visitas Concluídas</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma visita concluída registrada
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((visit) => (
                <div key={visit.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant={visit.type === 'queue' ? 'secondary' : 'outline'}>
                      {visit.type === 'queue' ? '🎫 Fila' : '📅 Reserva'}
                    </Badge>
                    <div>
                      <p className="font-medium">{formatDate(visit.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {visit.party_size} {visit.party_size === 1 ? 'pessoa' : 'pessoas'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

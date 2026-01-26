import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Mail, Eye, Users, CheckCircle2, XCircle } from "lucide-react";
import { useCustomersEnhanced, CustomerFilter, SourceFilter, MarketingFilter } from "@/hooks/useCustomersEnhanced";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerKPIs } from "@/components/customers/CustomerKPIs";
import { CustomerFilters } from "@/components/customers/CustomerFilters";
import { CustomerStatusBadge } from "@/components/customers/CustomerStatusBadge";

export default function Customers() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [marketingFilter, setMarketingFilter] = useState<MarketingFilter>("all");
  const [sortBy, setSortBy] = useState<'name' | 'visits' | 'lastVisit'>('lastVisit');
  
  // Passar searchTerm para o hook para busca funcionar no Supabase
  const { customers, loading, getKPIs } = useCustomersEnhanced(searchTerm);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
    return days === 0 ? 'Hoje' : days === 1 ? 'Ontem' : `${days} dias atrás`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filtrar clientes
  const filteredCustomers = customers
    .filter(customer => {
      // Filtro de busca
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm) ||
        (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filtro de status
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;

      // Filtro de origem
      let matchesSource = true;
      if (sourceFilter === 'queue') {
        matchesSource = customer.queue_completed > 0;
      } else if (sourceFilter === 'reservation') {
        matchesSource = customer.reservations_completed > 0;
      }

      // Filtro de marketing
      let matchesMarketing = true;
      if (marketingFilter === 'opt-in') {
        matchesMarketing = customer.marketing_opt_in === true;
      } else if (marketingFilter === 'opt-out') {
        matchesMarketing = customer.marketing_opt_in === false;
      }

      return matchesSearch && matchesStatus && matchesSource && matchesMarketing;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'visits') {
        return b.visits_completed - a.visits_completed;
      } else {
        // lastVisit
        const dateA = a.last_visit_at ? new Date(a.last_visit_at).getTime() : 0;
        const dateB = b.last_visit_at ? new Date(b.last_visit_at).getTime() : 0;
        return dateB - dateA;
      }
    });

  const kpis = getKPIs();

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Sistema de CRM inteligente</p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {filteredCustomers.length} de {customers.length} clientes
          </span>
        </div>
      </div>

      {/* KPIs */}
      <CustomerKPIs
        total={kpis.total}
        active={kpis.active}
        vip={kpis.vip}
        newCustomers={kpis.newCustomers}
        inactive={kpis.inactive}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <CustomerFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            marketingFilter={marketingFilter}
            onMarketingFilterChange={setMarketingFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
          />
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all'
                  ? "Tente ajustar os filtros de busca."
                  : "Ainda não há clientes cadastrados."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Marketing</TableHead>
                  <TableHead>Visitas Concluídas</TableHead>
                  <TableHead>Última Visita</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(customer.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center text-muted-foreground">
                          <Phone className="w-3 h-3 mr-1" />
                          {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="flex items-center text-muted-foreground">
                            <Mail className="w-3 h-3 mr-1" />
                            {customer.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CustomerStatusBadge status={customer.status} />
                    </TableCell>
                    <TableCell>
                      {customer.marketing_opt_in ? (
                        <div className="flex items-center gap-1.5 text-sm text-success">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aceita promoções</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <XCircle className="w-4 h-4" />
                          <span>Não aceita</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-lg">{customer.visits_completed}</div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>🎫 Fila: {customer.queue_completed}</div>
                        <div>📅 Reserva: {customer.reservations_completed}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.last_visit_at ? (
                        <>
                          <div className="text-sm">{formatDate(customer.last_visit_at)}</div>
                          <div className="text-xs text-muted-foreground">
                            {getDaysAgo(customer.last_visit_at)}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">Nunca visitou</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/customers/${customer.id}`);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
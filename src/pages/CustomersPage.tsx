import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Mail, Eye, Users, CheckCircle2, XCircle, Send, History, Star } from "lucide-react";
import { useRestaurantCustomers, CustomerFilter, SourceFilter, MarketingFilter, PeriodFilter } from "@/hooks/useRestaurantCustomers";
import { useRestaurantCampaigns } from "@/hooks/useRestaurantCampaigns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerKPIsEnhanced } from "@/components/customers/CustomerKPIsEnhanced";
import { CustomerFiltersEnhanced } from "@/components/customers/CustomerFiltersEnhanced";
import { CreateCampaignDialog } from "@/components/customers/CreateCampaignDialog";
import { RESTAURANT_ID } from "@/config/current-restaurant";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [marketingFilter, setMarketingFilter] = useState<MarketingFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [sortBy, setSortBy] = useState<'name' | 'visits' | 'lastVisit'>('lastVisit');
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);
  
  const { customers, loading, getKPIs, filterCustomers, getMarketingEligible } = useRestaurantCustomers(RESTAURANT_ID);
  const { campaigns, createCampaign, sendCampaign, getStats } = useRestaurantCampaigns(RESTAURANT_ID);

  // Filtrar e ordenar clientes
  const filteredCustomers = useMemo(() => {
    const filtered = filterCustomers(statusFilter, sourceFilter, marketingFilter, periodFilter, searchTerm);
    
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.customer_name || '').localeCompare(b.customer_name || '');
      } else if (sortBy === 'visits') {
        return b.total_visits - a.total_visits;
      } else {
        const dateA = new Date(a.last_seen_at).getTime();
        const dateB = new Date(b.last_seen_at).getTime();
        return dateB - dateA;
      }
    });
  }, [filterCustomers, statusFilter, sourceFilter, marketingFilter, periodFilter, searchTerm, sortBy]);

  const kpis = getKPIs();
  const campaignStats = getStats();
  const eligibleCustomers = getMarketingEligible();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
    return days === 0 ? 'Hoje' : days === 1 ? 'Ontem' : `${days} dias atrás`;
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getCustomerStatus = (customer: typeof customers[0]) => {
    if (customer.vip) return 'vip';
    const lastSeen = new Date(customer.last_seen_at);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const createdAt = new Date(customer.created_at);
    
    if (createdAt >= sevenDaysAgo) return 'new';
    if (lastSeen < thirtyDaysAgo) return 'inactive';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'vip':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">⭐ VIP</Badge>;
      case 'new':
        return <Badge className="bg-primary/20 text-primary border-primary/30">🆕 Novo</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className="text-muted-foreground">Inativo</Badge>;
      default:
        return <Badge className="bg-success/20 text-success border-success/30">Ativo</Badge>;
    }
  };

  const handleCreateCampaign = async (data: {
    title: string;
    subject: string;
    message: string;
    ctaText?: string;
    ctaUrl?: string;
    couponCode?: string;
    expiresAt?: string;
    recipients: { email: string; name?: string; customerId?: string }[];
  }) => {
    setIsSubmittingCampaign(true);
    try {
      const campaign = await createCampaign({
        title: data.title,
        subject: data.subject,
        message: data.message,
        cta_text: data.ctaText,
        cta_url: data.ctaUrl,
        coupon_code: data.couponCode,
        expires_at: data.expiresAt,
      });

      if (campaign) {
        await sendCampaign(campaign.id, data.recipients);
      }
    } finally {
      setIsSubmittingCampaign(false);
    }
  };

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
          <p className="text-muted-foreground">CRM completo do seu restaurante</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {filteredCustomers.length} de {customers.length} clientes
          </div>
          <Button onClick={() => setCampaignDialogOpen(true)} className="gap-2">
            <Send className="w-4 h-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <CustomerKPIsEnhanced
        total={kpis.total}
        active={kpis.active}
        vip={kpis.vip}
        newCustomers={kpis.newCustomers}
        inactive={kpis.inactive}
        marketingOptIn={kpis.marketingOptIn}
      />

      {/* Tabs */}
      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="w-4 h-4" />
            Clientes ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <History className="w-4 h-4" />
            Campanhas ({campaignStats.totalCampaigns})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Clientes */}
        <TabsContent value="customers" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <CustomerFiltersEnhanced
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                sourceFilter={sourceFilter}
                onSourceFilterChange={setSourceFilter}
                marketingFilter={marketingFilter}
                onMarketingFilterChange={setMarketingFilter}
                periodFilter={periodFilter}
                onPeriodFilterChange={setPeriodFilter}
                sortBy={sortBy}
                onSortByChange={setSortBy}
              />
            </CardContent>
          </Card>

          {/* Customers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>
                Clientes que entraram na fila ou fizeram reserva
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhum cliente encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all'
                      ? "Tente ajustar os filtros de busca."
                      : "Os clientes aparecerão automaticamente ao usar a fila ou reservas."}
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
                      <TableHead>Visitas</TableHead>
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
                                {getInitials(customer.customer_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {customer.customer_name || 'Sem nome'}
                                {customer.vip && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                              </div>
                              {customer.tags?.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {customer.tags.slice(0, 2).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center text-muted-foreground">
                              <Mail className="w-3 h-3 mr-1" />
                              {customer.customer_email}
                            </div>
                            {customer.customer_phone && (
                              <div className="flex items-center text-muted-foreground">
                                <Phone className="w-3 h-3 mr-1" />
                                {customer.customer_phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(getCustomerStatus(customer))}
                        </TableCell>
                        <TableCell>
                          {customer.marketing_optin ? (
                            <div className="flex items-center gap-1.5 text-sm text-success">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Aceita</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <XCircle className="w-4 h-4" />
                              <span>Não aceita</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-lg">{customer.total_visits}</div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>🎫 Fila: {customer.total_queue_visits}</div>
                            <div>📅 Reserva: {customer.total_reservation_visits}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDate(customer.last_seen_at)}</div>
                          <div className="text-xs text-muted-foreground">
                            {getDaysAgo(customer.last_seen_at)}
                          </div>
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
        </TabsContent>

        {/* Tab: Campanhas */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Campaign Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{campaignStats.totalCampaigns}</div>
                <div className="text-sm text-muted-foreground">Total de campanhas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-success">{campaignStats.sentCampaigns}</div>
                <div className="text-sm text-muted-foreground">Enviadas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-muted-foreground">{campaignStats.draftCampaigns}</div>
                <div className="text-sm text-muted-foreground">Rascunhos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">{campaignStats.totalRecipients}</div>
                <div className="text-sm text-muted-foreground">Destinatários total</div>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Histórico de Campanhas</CardTitle>
                <CardDescription>
                  Campanhas de e-mail enviadas para seus clientes
                </CardDescription>
              </div>
              <Button onClick={() => setCampaignDialogOpen(true)} className="gap-2">
                <Send className="w-4 h-4" />
                Nova Campanha
              </Button>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhuma campanha criada</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie sua primeira campanha de e-mail marketing
                  </p>
                  <Button onClick={() => setCampaignDialogOpen(true)}>
                    Criar campanha
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Destinatários</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead>Enviada em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div className="font-medium">{campaign.title}</div>
                          <div className="text-sm text-muted-foreground">{campaign.subject}</div>
                        </TableCell>
                        <TableCell>
                          {campaign.status === 'sent' && (
                            <Badge className="bg-success/20 text-success">Enviada</Badge>
                          )}
                          {campaign.status === 'draft' && (
                            <Badge variant="secondary">Rascunho</Badge>
                          )}
                          {campaign.status === 'sending' && (
                            <Badge className="bg-primary/20 text-primary">Enviando...</Badge>
                          )}
                          {campaign.status === 'failed' && (
                            <Badge variant="destructive">Falhou</Badge>
                          )}
                        </TableCell>
                        <TableCell>{campaign.total_recipients || '-'}</TableCell>
                        <TableCell>{formatDate(campaign.created_at)}</TableCell>
                        <TableCell>
                          {campaign.sent_at ? formatDate(campaign.sent_at) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        eligibleCustomers={eligibleCustomers}
        onSubmit={handleCreateCampaign}
        isSubmitting={isSubmittingCampaign}
      />
    </div>
  );
}

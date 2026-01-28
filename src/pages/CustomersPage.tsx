import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Users } from "lucide-react";
import { useRestaurantCustomers, CustomerFilter, SourceFilter, MarketingFilter, PeriodFilter, RestaurantCustomer } from "@/hooks/useRestaurantCustomers";
import { useRestaurantCampaigns } from "@/hooks/useRestaurantCampaigns";
import { useSendPromotion } from "@/hooks/useSendPromotion";
import { useCustomerInsights, generateInsightsForCustomer } from "@/hooks/useCustomerInsights";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerStrategicKPIs } from "@/components/customers/CustomerStrategicKPIs";
import { CustomerListPremium } from "@/components/customers/CustomerListPremium";
import { CustomerFiltersClean } from "@/components/customers/CustomerFiltersClean";
import { CreateCampaignDialog } from "@/components/customers/CreateCampaignDialog";
import { SendPromotionDialog } from "@/components/customers/SendPromotionDialog";
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
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<RestaurantCustomer | null>(null);
  
  
  const { customers, loading, getKPIs, filterCustomers, getMarketingEligible, refetch } = useRestaurantCustomers(RESTAURANT_ID);
  const { campaigns, createCampaign, sendCampaign, getStats } = useRestaurantCampaigns(RESTAURANT_ID);
  const { sendPromotion, sending: sendingPromotion } = useSendPromotion();
  useCustomerInsights(RESTAURANT_ID);

  // Gera insights em tempo real para cada cliente
  const customerInsightsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof generateInsightsForCustomer>>();
    customers.forEach(customer => {
      const insights = generateInsightsForCustomer(customer);
      if (insights.length > 0) {
        map.set(customer.id, insights);
      }
    });
    return map;
  }, [customers]);

  // Função para obter mensagem de insight
  const getInsightMessage = (customer: RestaurantCustomer): string | null => {
    const insights = customerInsightsMap.get(customer.id);
    if (!insights || insights.length === 0) return null;
    
    // Gerar mensagens curtas e acionáveis
    const insight = insights[0];
    switch (insight.insight_type) {
      case 'vip_missing':
        return 'VIP sem visita recente. Hora de uma oferta especial!';
      case 'inactive':
        return 'Uma promoção pode trazê-lo de volta';
      case 'recurrent':
        return 'Cliente frequente. Candidato a VIP!';
      case 'new_customer':
        return 'Cliente novo! Boas-vindas podem fidelizar';
      default:
        return null;
    }
  };

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

  // Calcular KPIs estratégicos
  const strategicKPIs = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return {
      activeCustomers: customers.filter(c => new Date(c.last_seen_at) >= thirtyDaysAgo).length,
      frequentCustomers: customers.filter(c => c.total_visits >= 3 && !c.vip).length,
      highValueCustomers: customers.filter(c => c.vip || c.total_visits >= 10).length,
      marketingOptIn: customers.filter(c => c.marketing_optin).length,
      atRiskCustomers: customers.filter(c => new Date(c.last_seen_at) < thirtyDaysAgo).length,
    };
  }, [customers]);

  const handleFilterClick = (filter: string) => {
    switch (filter) {
      case 'active':
        setStatusFilter('active');
        break;
      case 'vip':
      case 'frequent':
        setStatusFilter('vip');
        break;
      case 'inactive':
        setStatusFilter('inactive');
        break;
      case 'marketing':
        setMarketingFilter('opt-in');
        break;
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
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="h-12 bg-muted rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground mt-1">
          CRM completo • {customers.length} clientes cadastrados
        </p>
      </div>

      {/* Strategic KPIs */}
      <CustomerStrategicKPIs
        activeCustomers={strategicKPIs.activeCustomers}
        frequentCustomers={strategicKPIs.frequentCustomers}
        highValueCustomers={strategicKPIs.highValueCustomers}
        marketingOptIn={strategicKPIs.marketingOptIn}
        atRiskCustomers={strategicKPIs.atRiskCustomers}
        onFilterClick={handleFilterClick}
      />

      {/* Filters */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <CustomerFiltersClean
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

      {/* Customer List Premium */}
      <CustomerListPremium
        customers={filteredCustomers}
        onViewProfile={(customerId) => {
          // Navigate to full customer profile page
          navigate(`/customers/${customerId}`);
        }}
        onSendPromotion={(customer) => {
          setSelectedCustomer(customer);
          setPromotionDialogOpen(true);
        }}
        getInsightMessage={getInsightMessage}
      />

      {/* Dialogs */}
      <CreateCampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        eligibleCustomers={eligibleCustomers}
        onSubmit={handleCreateCampaign}
        isSubmitting={isSubmittingCampaign}
      />

      {selectedCustomer && (
        <SendPromotionDialog
          open={promotionDialogOpen}
          onOpenChange={setPromotionDialogOpen}
          customer={selectedCustomer}
          onSubmit={async (data) => {
            await sendPromotion({
              to_email: data.recipients[0]?.email || selectedCustomer.customer_email,
              to_name: data.recipients[0]?.name || selectedCustomer.customer_name || undefined,
              subject: data.subject,
              message: data.message,
              coupon_code: data.couponCode,
              expires_at: data.expiresAt,
              cta_text: data.ctaText,
              cta_url: data.ctaUrl,
              image_url: data.imageUrl,
            });
          }}
          isSubmitting={sendingPromotion}
        />
      )}
    </div>
  );
}

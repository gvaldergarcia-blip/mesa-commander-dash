import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, Loader2, LayoutDashboard, Printer, Package, Users, List, Clock, MessageSquare, ShoppingCart, PackageX, PackagePlus, Activity } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLabelProducts } from "@/hooks/useLabelProducts";
import { useLabels } from "@/hooks/useLabels";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { EmployeesManager } from "@/components/labels/EmployeesManager";
import { SmsLogsTab } from "@/components/labels/SmsLogsTab";
import { StockCheckTab } from "@/components/labels/StockCheckTab";
import { ShoppingListTab } from "@/components/labels/ShoppingListTab";
import { SmartReprintCard } from "@/components/labels/SmartReprintCard";
import { ReceivingTab } from "@/components/labels/receiving/ReceivingTab";
import { useStockStatus } from "@/hooks/useStockStatus";
import { LabelDashboard } from "@/components/labels/LabelDashboard";
import { TodayTab } from "@/components/labels/TodayTab";
import { LabelFilters, LabelFiltersState, emptyFilters } from "@/components/labels/LabelFilters";
import { LabelsList } from "@/components/labels/LabelsList";
import { PrintFlow } from "@/components/labels/PrintFlow";
import { LabeledProductsTab } from "@/components/labels/LabeledProductsTab";
import { computeStats, classifyExpiry, toCsv, downloadCsv } from "@/lib/labels/utils";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function EtiquetasPage() {
  const { products, isLoading: prodLoading, createProduct, updateProduct, deleteProduct, isMutating } = useLabelProducts();
  const { labels, isLoading: labelsLoading } = useLabels();
  const { employees } = useLabelEmployees();
  const { missingProducts } = useStockStatus();

  const [tab, setTab] = useState("dashboard");

  // Navegação lateral agrupada por seção
  const NAV_SECTIONS: {
    label: string;
    items: { value: string; icon: any; label: string; badge?: number }[];
  }[] = [
    {
      label: "Diário",
      items: [
        { value: "hoje", icon: Activity, label: "Hoje" },
      ],
    },
    {
      label: "Entradas",
      items: [
        { value: "recebimento", icon: PackagePlus, label: "Recebimento" },
      ],
    },
    {
      label: "Operação",
      items: [
        { value: "estoque", icon: PackageX, label: "Estoque" },
      ],
    },
    {
      label: "Cadastros",
      items: [
        { value: "produtos", icon: Package, label: "Produtos" },
        { value: "funcionarios", icon: Users, label: "Funcionários" },
        { value: "dashboard", icon: LayoutDashboard, label: "Relatórios" },
        { value: "sms", icon: MessageSquare, label: "SMS" },
      ],
    },
  ];
  const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
  const currentItem = ALL_ITEMS.find((i) => i.value === tab) ?? ALL_ITEMS[0];
  const [filters, setFilters] = useState<LabelFiltersState>(emptyFilters);
  const [statFilter, setStatFilter] = useState<string | null>(null);

  const [printInitialProduct, setPrintInitialProduct] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(labels), [labels]);

  // Toast alert: vencem hoje
  useEffect(() => {
    if (!labelsLoading && stats.today > 0) {
      const key = `etq-alert-${new Date().toDateString()}`;
      if (!sessionStorage.getItem(key)) {
        toast.warning(`⚠️ ${stats.today} produto(s) vencem hoje`, {
          action: { label: "Ver", onClick: () => setStatFilter("today") },
        });
        sessionStorage.setItem(key, "1");
      }
    }
  }, [labelsLoading, stats.today]);

  const filtered = useMemo(() => {
    return labels.filter((l) => {
      // stat card filter
      if (statFilter === "expired" && classifyExpiry(l.expiry_date) !== "expired") return false;
      if (statFilter === "today" && classifyExpiry(l.expiry_date) !== "today") return false;
      if (statFilter === "tomorrow" && classifyExpiry(l.expiry_date) !== "tomorrow") return false;
      if (statFilter === "expired" || statFilter === "today" || statFilter === "tomorrow") {
        if (l.status === "discharged") return false;
      }
      if (filters.expiredOnly && classifyExpiry(l.expiry_date) !== "expired") return false;
      // text
      if (filters.search && !l.product_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.employeeId !== "all" && l.employee_id !== filters.employeeId) return false;
      if (filters.conservation !== "all" && l.conservation_method !== filters.conservation) return false;
      if (filters.status !== "all") {
        if (filters.status === "today") {
          if (classifyExpiry(l.expiry_date) !== "today" || l.status === "discharged") return false;
        } else if (l.status !== filters.status) return false;
      }
      if (filters.startDate && new Date(l.created_at) < new Date(filters.startDate)) return false;
      if (filters.endDate) {
        const end = new Date(filters.endDate); end.setHours(23, 59, 59, 999);
        if (new Date(l.created_at) > end) return false;
      }
      return true;
    });
  }, [labels, statFilter, filters]);

  const handleExport = () => {
    downloadCsv(`etiquetas-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filtered));
  };

  return (
    <div className="p-3 md:p-8 space-y-4 md:space-y-6 max-w-[1500px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-4 border-b border-border/50 pb-4 md:pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 md:gap-3 mb-1">
            <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg border border-primary/20 shrink-0">
              <Tag className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <h1 className="text-xl md:text-4xl font-bold tracking-tight leading-tight break-words">Etiquetas de Alimentos</h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground max-w-xl">
            Gestão de validade, rastreabilidade e baixas para sua cozinha.
          </p>
        </div>
        <Button onClick={() => setTab("imprimir")} size="lg" className="gap-2 shadow-lg shadow-primary/20 w-full md:w-auto">
          <Printer className="h-4 w-4" /> Nova etiqueta
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="mt-2">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
          {/* ===== SIDEBAR (desktop) ===== */}
          <aside className="hidden md:block">
            <nav className="sticky top-4 rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-2 space-y-4">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label}>
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    {section.label}
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = tab === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setTab(item.value)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left",
                            active
                              ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && item.badge > 0 ? (
                            <span className={cn(
                              "h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold inline-flex items-center justify-center",
                              active ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
                            )}>
                              {item.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* ===== NAV MOBILE (select) ===== */}
          <div className="md:hidden">
            <Select value={tab} onValueChange={setTab}>
              <SelectTrigger className="h-11">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <currentItem.icon className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{currentItem.label}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {NAV_SECTIONS.map((section) => (
                  <div key={section.label}>
                    <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                      {section.label}
                    </div>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SelectItem key={item.value} value={item.value}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {item.label}
                            {item.badge && item.badge > 0 ? (
                              <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold inline-flex items-center justify-center">
                                {item.badge}
                              </span>
                            ) : null}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ===== CONTEÚDO ===== */}
          <div className="min-w-0 space-y-5">
        <TabsContent value="hoje" className="mt-0">
          <TodayTab
            onQuickAction={(action) => {
              if (action === "new-label") setTab("imprimir");
              else if (action === "new-receipt") setTab("recebimento");
              else if (action === "shopping") setTab("compras");
              else if (action === "labels") setTab("imprimir");
            }}
          />
        </TabsContent>

        {/* ===== RECEBIMENTO INTELIGENTE ===== */}
        <TabsContent value="recebimento">
          <ReceivingTab />
        </TabsContent>

        {/* ===== DASHBOARD ===== */}
        <TabsContent value="dashboard" className="space-y-5">
          <SmartReprintCard
            onPrintProduct={(pid) => {
              setPrintInitialProduct(pid);
              setTab("imprimir");
            }}
          />
          <LabelDashboard
            labels={labels}
            stats={stats}
            productCount={products.length}
            activeFilter={statFilter}
            onSelectStat={(f) => {
              setStatFilter(f);
              if (f === "products") setTab("produtos");
              else if (f) setTab("dashboard");
            }}
            onQuickAction={(action) => {
              if (action === "new-label") setTab("imprimir");
              else if (action === "new-product") setTab("produtos");
              else if (action === "new-employee") setTab("funcionarios");
              else if (action === "validity") { setStatFilter("expired"); setTab("dashboard"); }
            }}
          />
        </TabsContent>

        {/* ===== IMPRIMIR ===== */}
        <TabsContent value="imprimir">
          <Card className="p-4 md:p-8 bg-card/30">
            <CardContent className="p-0">
              <PrintFlow
                initialProductId={printInitialProduct}
                onFinished={() => {
                  setPrintInitialProduct(null);
                  setTab("dashboard");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LISTA DE COMPRAS ===== */}
        <TabsContent value="compras" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Lista de compras</h2>
            <p className="text-sm text-muted-foreground">Produtos em falta marcados pela equipe. Quando chegar, marque como recebido e já imprima a etiqueta.</p>
          </div>
          <ShoppingListTab onPrintProduct={() => setTab("imprimir")} />
        </TabsContent>

        {/* ===== ESTOQUE (marcação rápida) ===== */}
        <TabsContent value="estoque" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Estoque rápido</h2>
            <p className="text-sm text-muted-foreground">Marque com 1 toque cada produto como Ok ou Falta. As faltas aparecem automaticamente na Lista de compras.</p>
          </div>
          <StockCheckTab />
        </TabsContent>

        {/* ===== PRODUTOS ETIQUETADOS ===== */}
        <TabsContent value="produtos" className="space-y-5">
          <LabeledProductsTab
            onPrintProduct={(pid) => {
              setPrintInitialProduct(pid);
              setTab("imprimir");
            }}
          />
        </TabsContent>

        {/* ===== FUNCIONÁRIOS ===== */}
        <TabsContent value="funcionarios">
          <EmployeesManager />
        </TabsContent>

        {/* ===== HISTÓRICO DE SMS ===== */}
        <TabsContent value="sms" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Histórico de SMS</h2>
            <p className="text-sm text-muted-foreground">Todos os relatórios e alertas enviados aos funcionários.</p>
          </div>
          <SmsLogsTab />
        </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* Dialogs removidos — cadastro de produtos agora é automático via Recebimento. */}
    </div>
  );
}

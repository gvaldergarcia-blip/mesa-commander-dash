import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tag, LayoutDashboard, Package, Users, List, MessageSquare, PackageX, Activity, ChefHat, RefreshCw, Zap, Truck } from "lucide-react";

import { useLabels } from "@/hooks/useLabels";
import { EmployeesManager } from "@/components/labels/EmployeesManager";
import { SmsLogsTab } from "@/components/labels/SmsLogsTab";
import { StockCheckTab } from "@/components/labels/StockCheckTab";
import { FastPrintTab } from "@/components/labels/FastPrintTab";
import { ProductRegistryTab } from "@/components/labels/ProductRegistryTab";
import { LabelDashboard } from "@/components/labels/LabelDashboard";
import { OperationalProductsList } from "@/components/labels/OperationalProductsList";
import { TodayTab } from "@/components/labels/TodayTab";
import { RenewalPanel } from "@/components/labels/RenewalPanel";
import { useLabelRenewals } from "@/hooks/useLabelRenewals";
import { LabeledProductsTab } from "@/components/labels/LabeledProductsTab";
import { ProducaoInternaTab } from "@/components/labels/ProducaoInternaTab";
import { ReceiptEntryTab } from "@/components/labels/receiving/ReceiptEntryTab";
import type { ReceiptPrintContext } from "@/lib/labels/receiptContext";
import { getOperationalGroups, type OperationalView } from "@/lib/labels/operationalDashboard";
import { useRestaurant } from "@/contexts/RestaurantContext";

export default function EtiquetasPage() {
  const { labels, dischargeBulk } = useLabels();
  const { items: renewalItems, count: renewalCount } = useLabelRenewals();
  const { restaurant, user } = useRestaurant();

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const requestedView = searchParams.get("view") as OperationalView | null;
  const [tab, setTabState] = useState(requestedTab || "dashboard");

  // Navegação lateral agrupada por seção
  const NAV_SECTIONS: {
    label: string;
    items: { value: string; icon: any; label: string; badge?: number }[];
  }[] = [
    {
      label: "Operação diária",
      items: [
        { value: "imprimir", icon: Zap, label: "Imprimir etiqueta" },
      ],
    },
    {
      label: "Diário",
      items: [
        { value: "hoje", icon: Activity, label: "Hoje" },
        { value: "renovacao", icon: RefreshCw, label: "Renovação", badge: renewalCount },
      ],
    },
    {
      label: "Entradas",
      items: [
        { value: "recebimento", icon: Truck, label: "Recebimento" },
        { value: "producao", icon: ChefHat, label: "Produção Interna" },
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
        { value: "cadastro", icon: Package, label: "Produtos" },
        { value: "produtos", icon: List, label: "Etiquetas ativas" },
        { value: "funcionarios", icon: Users, label: "Funcionários" },
        { value: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { value: "sms", icon: MessageSquare, label: "SMS" },
      ],
    },
  ];
  const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
  const setTab = (value: string) => {
    setTabState(value);
    setSearchParams({ tab: value }, { replace: true });
  };

  useEffect(() => {
    if (requestedTab && ALL_ITEMS.some((item) => item.value === requestedTab)) {
      setTabState(requestedTab);
    }
  }, [requestedTab]);
  const [printInitialProduct, setPrintInitialProduct] = useState<string | null>(null);
  const [receiptContext, setReceiptContext] = useState<ReceiptPrintContext | null>(null);
  const [stockInitialSector, setStockInitialSector] = useState<string | null>(null);
  const [productsStatusFilter, setProductsStatusFilter] = useState<"all" | "ok" | "critical" | "expired" | "warning">("all");

  const operational = useMemo(() => getOperationalGroups(labels, renewalItems), [labels, renewalItems]);
  const userName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split("@")[0]
    || "equipe";

  const openOperationalView = (view: OperationalView) => {
    if (view === "renewal") {
      setTabState("renovacao");
      setSearchParams({ tab: "renovacao", view: "pending" }, { replace: true });
      return;
    }
    setSearchParams({ tab: "dashboard", view }, { replace: true });
  };

  const closeOperationalView = () => {
    setSearchParams({ tab: "dashboard" }, { replace: true });
  };

  return (
    <div className="p-3 md:p-8 space-y-4 md:space-y-6 max-w-[1500px] mx-auto">
      {tab !== "dashboard" && <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-4 border-b border-border/50 pb-4 md:pb-5">
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
      </header>}

      <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <div className="min-w-0 space-y-5">
        <TabsContent value="hoje" className="mt-0">
          <TodayTab
            onQuickAction={(action) => {
              if (action === "new-label") setTab("imprimir");
              else if (action === "new-receipt") setTab("imprimir");
              else if (action === "shopping") setTab("compras");
              else if (action === "labels") setTab("imprimir");
            }}
            onOpenProducts={(f) => {
              setProductsStatusFilter(f);
              setTab("produtos");
            }}
            onOpenStockFalta={() => {
              setStockInitialSector(null);
              setTab("estoque");
            }}
            onOpenRenewals={() => setTab("renovacao")}
          />
        </TabsContent>

        {/* ===== RENOVAÇÃO DE ETIQUETAS ===== */}
        <TabsContent value="renovacao" className="mt-0">
          <RenewalPanel actionOnly={searchParams.get("view") === "pending"} />
        </TabsContent>

        {/* ===== IMPRESSÃO RÁPIDA ===== */}
        <TabsContent value="imprimir" className="mt-0">
          <FastPrintTab
            initialProductId={printInitialProduct}
            onManageProducts={() => setTab("cadastro")}
            receiptContext={receiptContext}
            onClearReceiptContext={() => setReceiptContext(null)}
          />
        </TabsContent>

        {/* ===== RECEBIMENTO (entrada no estoque) ===== */}
        <TabsContent value="recebimento" className="mt-0">
          <ReceiptEntryTab
            onManageProducts={() => setTab("cadastro")}
            onPrintReceipt={(ctx) => {
              setReceiptContext(ctx);
              setTab("imprimir");
            }}
          />
        </TabsContent>

        {/* ===== CADASTRO DE PRODUTOS ===== */}
        <TabsContent value="cadastro" className="mt-0">
          <ProductRegistryTab
            onPrintProduct={(pid) => {
              setPrintInitialProduct(pid);
              setTab("imprimir");
            }}
          />
        </TabsContent>

        {/* ===== PRODUÇÃO INTERNA ===== */}
        <TabsContent value="producao">
          <ProducaoInternaTab />
        </TabsContent>

        {/* ===== CENTRAL OPERACIONAL ===== */}
        <TabsContent value="dashboard" className="mt-0">
          {requestedView && requestedView !== "renewal" ? (
            <OperationalProductsList
              view={requestedView}
              labels={operational[requestedView]}
              resolveOriginal={operational.resolveOriginal}
              onBack={closeOperationalView}
              onDischarge={dischargeBulk}
            />
          ) : (
            <LabelDashboard
              restaurantName={restaurant?.name || "Restaurante"}
              userName={userName}
              counts={{
                expired: operational.expired.length,
                tomorrow: operational.tomorrow.length,
                renewal: operational.renewal.length,
                ok: operational.ok.length,
              }}
              onOpen={openOperationalView}
            />
          )}
        </TabsContent>

        {/* ===== ESTOQUE (marcação rápida) ===== */}
        <TabsContent value="estoque" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Estoque rápido</h2>
            <p className="text-sm text-muted-foreground">Marque com 1 toque cada produto: Suficiente, Atenção ou Precisa repor.</p>
          </div>
          <StockCheckTab initialSector={stockInitialSector} />
        </TabsContent>

        {/* ===== PRODUTOS ETIQUETADOS ===== */}
        <TabsContent value="produtos" className="space-y-5">
          <LabeledProductsTab
            initialStatusFilter={productsStatusFilter}
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
      </Tabs>

      {/* Dialogs removidos — cadastro de produtos agora é automático via Recebimento. */}
    </div>
  );
}

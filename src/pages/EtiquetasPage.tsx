import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, Plus, Pencil, Trash2, Loader2, LayoutDashboard, Printer, Package, Users, List, Clock, MessageSquare, ShoppingCart, PackageX, PackagePlus, Activity } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelProduct, useLabelProducts } from "@/hooks/useLabelProducts";
import { useLabels } from "@/hooks/useLabels";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { ProductFormDialog } from "@/components/labels/ProductFormDialog";
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
import { computeStats, classifyExpiry, toCsv, downloadCsv } from "@/lib/labels/utils";
import { PRODUCT_CATEGORIES, getValidityRisk, getCategoryHex, getCategoryIcon, getCategoryTagStyle, NO_CATEGORY_HEX, withAlpha } from "@/lib/labels/categories";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
        { value: "imprimir", icon: Printer, label: "Imprimir" },
        { value: "estoque", icon: PackageX, label: "Estoque" },
        { value: "compras", icon: ShoppingCart, label: "Compras", badge: missingProducts.length },
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

  // Product dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LabelProduct | null>(null);
  const [delTarget, setDelTarget] = useState<LabelProduct | null>(null);
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("all");
  const [productSearchFilter, setProductSearchFilter] = useState<string>("");
  const [printInitialProduct, setPrintInitialProduct] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(labels), [labels]);

  const filteredProducts = useMemo(() => {
    const term = productSearchFilter.trim().toLowerCase();
    return products.filter((p) => {
      if (productCategoryFilter !== "all") {
        const cat = p.category || "Outros";
        if (productCategoryFilter === "__none__") {
          if (p.category) return false;
        } else if (cat !== productCategoryFilter) return false;
      }
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, productCategoryFilter, productSearchFilter]);

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

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        {/* ===== NAV PRIMÁRIA: 4 áreas ===== */}
        <div className="-mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto scrollbar-thin">
          <div className="inline-flex md:grid md:grid-cols-4 md:w-full h-auto p-1 gap-1 rounded-lg bg-muted">
            {[
              { key: "hoje", icon: Activity, label: "Hoje" },
              { key: "entradas", icon: PackagePlus, label: "Entradas" },
              { key: "operacao", icon: List, label: "Operação" },
              { key: "cadastros", icon: Package, label: "Cadastros" },
            ].map((a) => {
              const active = area === a.key;
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => goArea(a.key)}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2.5 text-xs md:text-sm font-semibold rounded-md transition-all",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" /> {a.label}
                  {a.key === "operacao" && missingProducts.length > 0 && (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold inline-flex items-center justify-center">
                      {missingProducts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== SUB-NAV (Operação / Cadastros) ===== */}
        {area === "operacao" && (
          <div className="-mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto scrollbar-thin">
            <div className="inline-flex gap-1 p-1 rounded-lg border border-border/60 bg-card/40">
              {OP_SUBTABS.map((s) => {
                const Icon = s.icon;
                const active = tab === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setTab(s.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {s.label}
                    {s.value === "compras" && missingProducts.length > 0 && (
                      <span className={cn(
                        "ml-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center",
                        active ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"
                      )}>
                        {missingProducts.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {area === "cadastros" && (
          <div className="-mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto scrollbar-thin">
            <div className="inline-flex gap-1 p-1 rounded-lg border border-border/60 bg-card/40">
              {CAD_SUBTABS.map((s) => {
                const Icon = s.icon;
                const active = tab === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setTab(s.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== HOJE (timeline operacional) ===== */}
        <TabsContent value="hoje">
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
              else if (action === "new-product") { setEditing(null); setFormOpen(true); setTab("produtos"); }
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

        {/* ===== PRODUTOS ===== */}
        <TabsContent value="produtos" className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Produtos Cadastrados</h2>
              <p className="text-[11px] text-primary uppercase tracking-widest font-bold mt-1">
                {filteredProducts.length} de {products.length} {products.length === 1 ? "Item" : "Itens"}
              </p>
            </div>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Buscar produto..."
              value={productSearchFilter}
              onChange={(e) => setProductSearchFilter(e.target.value)}
              className="sm:max-w-xs bg-background border-input placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              {[
                { value: "all", label: "Todas" },
                ...PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c })),
                { value: "__none__", label: "Sem categoria" },
              ].map((opt) => {
                const active = productCategoryFilter === opt.value;
                let activeStyle: React.CSSProperties | undefined;
                if (active) {
                  if (opt.value === "all") {
                    activeStyle = { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "transparent" };
                  } else {
                    const hex = opt.value === "__none__" ? NO_CATEGORY_HEX : getCategoryHex(opt.value);
                    activeStyle = {
                      backgroundColor: withAlpha(hex, 0.2),
                      borderColor: hex,
                      color: hex,
                    };
                  }
                }
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProductCategoryFilter(opt.value)}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap",
                      !active && "bg-muted border-border text-muted-foreground hover:bg-muted/70"
                    )}
                    style={activeStyle}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {prodLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
              <Tag className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{products.length === 0 ? "Nenhum produto cadastrado." : "Nenhum produto corresponde aos filtros."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((p) => {
                const risk = getValidityRisk(p.validity_days);
                const borderHex = getCategoryHex(p.category);
                const icon = getCategoryIcon(p.category);
                const tagStyle = getCategoryTagStyle(p.category);
                return (
                  <div
                    key={p.id}
                    className="group relative p-5 rounded-2xl border border-border bg-card backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.35)] overflow-hidden"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${withAlpha(borderHex, 0.12)} 0%, transparent 60%)`,
                      boxShadow: `0 8px 32px -16px ${withAlpha(borderHex, 0.4)}`,
                    }}
                  >
                    <span
                      className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
                      style={{
                        background: `linear-gradient(180deg, ${borderHex} 0%, ${withAlpha(borderHex, 0.25)} 100%)`,
                        boxShadow: `0 0 14px ${withAlpha(borderHex, 0.7)}`,
                      }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-60"
                      style={{ background: `radial-gradient(circle, ${borderHex} 0%, transparent 70%)` }}
                    />
                    <div className="mb-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold truncate flex-1 text-foreground tracking-tight">{p.name}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md backdrop-blur-md border border-border"
                            style={risk.style}
                          >
                            {risk.label}
                          </span>
                          {icon && (
                            <span className="text-xl leading-none select-none" aria-hidden title={p.category || ""}>
                              {icon}
                            </span>
                          )}
                        </div>
                      </div>
                      {p.category && (
                        <span
                          className="inline-block mt-2 text-[11px] font-semibold backdrop-blur-md border"
                          style={{
                            backgroundColor: withAlpha(getCategoryHex(p.category), 0.14),
                            borderColor: withAlpha(getCategoryHex(p.category), 0.35),
                            color: getCategoryHex(p.category),
                            borderRadius: 999,
                            padding: "2px 10px",
                          }}
                        >
                          {p.category}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Validade: <span className="font-semibold text-foreground">{p.validity_days} {p.validity_days === 1 ? "dia" : "dias"}</span></span>
                      </div>
                      {(p.status === "inactive") && <span className="inline-block mt-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">Inativo</span>}
                      {p.notes && <p className="text-xs mt-2 italic line-clamp-2 text-muted-foreground">{p.notes}</p>}
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => { setEditing(p); setFormOpen(true); }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs font-medium text-foreground/80 transition-all hover:bg-muted hover:border-border"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDelTarget(p)}
                        className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-destructive border border-border bg-muted/40 hover:bg-destructive/10 hover:border-destructive/30 transition-all"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
      </Tabs>

      {/* Dialogs */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        isSubmitting={isMutating}
        onSubmit={async (input) => {
          if (editing) await updateProduct({ id: editing.id, input });
          else await createProduct(input);
        }}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto</AlertDialogTitle>
            <AlertDialogDescription>
              Remover <strong>{delTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (delTarget) await deleteProduct(delTarget.id); setDelTarget(null); }}
            >Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
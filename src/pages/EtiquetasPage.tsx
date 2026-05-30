import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, Plus, Pencil, Trash2, Loader2, LayoutDashboard, Printer, Package, Users, List, Clock, ScanLine } from "lucide-react";
import { LabelProduct, useLabelProducts } from "@/hooks/useLabelProducts";
import { useLabels } from "@/hooks/useLabels";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { ProductFormDialog } from "@/components/labels/ProductFormDialog";
import { EmployeesManager } from "@/components/labels/EmployeesManager";
import { LabelDashboard } from "@/components/labels/LabelDashboard";
import { LabelFilters, LabelFiltersState, emptyFilters } from "@/components/labels/LabelFilters";
import { LabelsList } from "@/components/labels/LabelsList";
import { PrintFlow } from "@/components/labels/PrintFlow";
import { computeStats, classifyExpiry, toCsv, downloadCsv } from "@/lib/labels/utils";
import { PRODUCT_CATEGORIES, getValidityRisk, getCategoryHex, getCategoryIcon, getCategoryTagStyle, NO_CATEGORY_HEX, withAlpha } from "@/lib/labels/categories";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getSiteBaseUrl } from "@/config/site-url";

export default function EtiquetasPage() {
  const navigate = useNavigate();
  const { products, isLoading: prodLoading, createProduct, updateProduct, deleteProduct, isMutating } = useLabelProducts();
  const { labels, isLoading: labelsLoading, dischargeBulk } = useLabels();
  const { employees } = useLabelEmployees();

  const [tab, setTab] = useState("dashboard");
  const [filters, setFilters] = useState<LabelFiltersState>(emptyFilters);
  const [statFilter, setStatFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // Product dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LabelProduct | null>(null);
  const [delTarget, setDelTarget] = useState<LabelProduct | null>(null);
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("all");
  const [productSearchFilter, setProductSearchFilter] = useState<string>("");

  const handleOpenOperatorMode = () => {
    const operatorPath = "/etiquetas/baixa-rapida";
    const isPreviewHost = typeof window !== "undefined" && (
      window.location.hostname.includes("lovable.app") ||
      window.location.hostname.includes("lovableproject.com")
    );

    if (isPreviewHost) {
      const publishedUrl = `${getSiteBaseUrl()}${operatorPath}`;
      const opened = window.open(publishedUrl, "_blank", "noopener,noreferrer");

      if (!opened && window.top) {
        window.top.location.href = publishedUrl;
      }

      return;
    }

    navigate(operatorPath);
  };

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

  const handleBulkDischarge = async (reason: any) => {
    await dischargeBulk({ ids: selected, reason });
    setSelected([]);
  };

  return (
    <div className="p-3 md:p-8 space-y-6 max-w-[1500px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
              <Tag className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Etiquetas de Alimentos</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Gestão completa de validade, rastreabilidade e baixas para sua cozinha profissional.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleOpenOperatorMode}
            size="lg"
            variant="outline"
            className="gap-2 border-[#FF6B00]/40 text-[#FF6B00] hover:bg-[#FF6B00]/10 hover:text-[#FF6B00]"
          >
            <ScanLine className="h-4 w-4" /> Modo Operador
          </Button>
          <Button onClick={() => setTab("imprimir")} size="lg" className="gap-2 shadow-lg shadow-primary/20">
            <Printer className="h-4 w-4" /> Nova etiqueta
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="grid grid-cols-5 w-full md:w-auto md:inline-grid">
          <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span></TabsTrigger>
          <TabsTrigger value="etiquetas" className="gap-2"><List className="h-4 w-4" /> <span className="hidden sm:inline">Etiquetas</span></TabsTrigger>
          <TabsTrigger value="imprimir" className="gap-2"><Printer className="h-4 w-4" /> <span className="hidden sm:inline">Imprimir</span></TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2"><Package className="h-4 w-4" /> <span className="hidden sm:inline">Produtos</span></TabsTrigger>
          <TabsTrigger value="funcionarios" className="gap-2"><Users className="h-4 w-4" /> <span className="hidden sm:inline">Funcionários</span></TabsTrigger>
        </TabsList>

        {/* ===== DASHBOARD ===== */}
        <TabsContent value="dashboard" className="space-y-5">
          <LabelDashboard
            labels={labels}
            stats={stats}
            productCount={products.length}
            activeFilter={statFilter}
            onSelectStat={(f) => {
              setStatFilter(f);
              if (f === "products") setTab("produtos");
              else if (f) setTab("etiquetas");
            }}
            onQuickAction={(action) => {
              if (action === "new-label") setTab("imprimir");
              else if (action === "new-product") { setEditing(null); setFormOpen(true); setTab("produtos"); }
              else if (action === "new-employee") setTab("funcionarios");
              else if (action === "validity") { setStatFilter("expired"); setTab("etiquetas"); }
            }}
          />
        </TabsContent>

        {/* ===== ETIQUETAS (lista) ===== */}
        <TabsContent value="etiquetas" className="space-y-5">
          <LabelFilters value={filters} onChange={setFilters} employees={employees} onExport={handleExport} />
          <LabelsList
            labels={filtered}
            isLoading={labelsLoading}
            selected={selected}
            onSelectedChange={setSelected}
            onBulkDischarge={handleBulkDischarge}
          />
        </TabsContent>

        {/* ===== IMPRIMIR ===== */}
        <TabsContent value="imprimir">
          <Card className="p-4 md:p-8 bg-card/30">
            <CardContent className="p-0">
              <PrintFlow onFinished={() => setTab("dashboard")} />
            </CardContent>
          </Card>
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
              className="sm:max-w-xs bg-[#1A1A2E] border-[#2D2D44] placeholder:text-[#718096] focus-visible:border-[#FF6B00] focus-visible:ring-0"
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
                    activeStyle = { backgroundColor: "#FF6B00", color: "#FFFFFF", borderColor: "transparent" };
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
                      !active && "bg-[#1E1E2E] border-[#2D2D44] text-[#718096] hover:bg-[#22223A]"
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
                    className="group relative p-5 rounded-2xl border border-white/[0.06] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-[0_20px_60px_-20px_rgba(255,107,0,0.35)] overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${withAlpha(borderHex, 0.10)} 0%, rgba(255,255,255,0.02) 45%, rgba(15,15,26,0.55) 100%)`,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px -16px ${withAlpha(borderHex, 0.4)}`,
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
                        <h3 className="text-lg font-semibold truncate flex-1 text-white tracking-tight">{p.name}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md backdrop-blur-md border border-white/10"
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
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-white/60">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Validade: <span className="font-semibold text-white">{p.validity_days} {p.validity_days === 1 ? "dia" : "dias"}</span></span>
                      </div>
                      {(p.status === "inactive") && <span className="inline-block mt-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/5 text-white/50 border border-white/10">Inativo</span>}
                      {p.notes && <p className="text-xs mt-2 italic line-clamp-2 text-white/50">{p.notes}</p>}
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => { setEditing(p); setFormOpen(true); }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-medium text-white/80 transition-all hover:bg-white/[0.08] hover:border-white/20"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDelTarget(p)}
                        className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-[#FC8181] border border-white/10 bg-white/[0.03] hover:bg-[#742A2A]/40 hover:border-[#FC8181]/30 transition-all"
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
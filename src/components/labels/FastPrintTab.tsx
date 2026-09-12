import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Search, Loader2, Zap, Check, Package, Truck, X, Plus, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { useLabelProducts, LabelProduct } from "@/hooks/useLabelProducts";
import { useLabels } from "@/hooks/useLabels";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { supabase } from "@/integrations/supabase/client";
import { printLabels, printLabelsMany, type PrintLabelData } from "./LabelPrintSheet";
import { cn } from "@/lib/utils";
import { CONSERVATION_LABEL } from "@/lib/labels/utils";
import { toast } from "sonner";
import { getSiteBaseUrl } from "@/config/site-url";
import { useLabelRenewals, type EndedCycleProduct } from "@/hooks/useLabelRenewals";
import type { ReceiptPrintContext } from "@/lib/labels/receiptContext";
import { ProductFormDialog } from "./ProductFormDialog";
import { LabelPrintPreview } from "./LabelPrintPreview";
import { useIsMobile } from "@/hooks/use-mobile";

/** Unidades disponíveis para a quantidade da etiqueta. */
const AMOUNT_UNITS = ["un", "g", "kg", "ml", "L"];

/** Lê o peso padrão do cadastro ("500 g", "1,5kg") em valor + unidade. */
function parseDefaultWeight(v?: string | null): { amount: string; unit: string } | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.replace(",", ".").match(/^([\d.]+)\s*([a-zA-ZçÇ]*)$/);
  if (!m) return null;
  const raw = (m[2] || "un").toLowerCase();
  const unit = raw === "l" ? "L" : AMOUNT_UNITS.find((u) => u.toLowerCase() === raw) || "un";
  return { amount: m[1], unit };
}

/**
 * Impressão Rápida — o coração do MesaClik.
 * Selecionar produto → Lote → Validade original → Quantidade → Imprimir.
 * Todo o resto vem do cadastro permanente do produto.
 */
export function FastPrintTab({
  initialProductId,
  onManageProducts,
  receiptContext,
  onClearReceiptContext,
}: {
  initialProductId?: string | null;
  onManageProducts?: () => void;
  /** Quando presente, a impressão vem de um RECEBIMENTO: etiqueta de produto LACRADO. */
  receiptContext?: ReceiptPrintContext | null;
  onClearReceiptContext?: () => void;
}) {
  const { products, isLoading, createProduct, isMutating } = useLabelProducts();
  const { activeEmployees } = useLabelEmployees();
  const { createLabel } = useLabels();
  const { restaurant } = useRestaurant();
  const { endedCycles } = useLabelRenewals();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [conservationFilter, setConservationFilter] = useState("all");
  const [product, setProduct] = useState<LabelProduct | null>(null);
  const [batch, setBatch] = useState("");
  const [originalExpiry, setOriginalExpiry] = useState("");
  const [qty, setQty] = useState(1);
  /** Quantidade do produto (peso/unidades) — vem do cadastro e é editável antes de imprimir. */
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState("un");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  /** Ciclo anterior encerrado que está sendo reetiquetado (novo valor original + novo lote). */
  const [newCycle, setNewCycle] = useState<EndedCycleProduct | null>(null);
  const batchRef = useRef<HTMLInputElement>(null);
  /** Itens do recebimento selecionados para impressão (pré-selecionados conforme a NF). */
  const [selectedReceiptItems, setSelectedReceiptItems] = useState<string[]>([]);
  const [receiptQty, setReceiptQty] = useState<Record<string, number>>({});
  /** Peso por item do recebimento — pré-preenchido pela NF e editável antes de imprimir. */
  const [receiptWeight, setReceiptWeight] = useState<Record<string, string>>({});
  const [printingReceipt, setPrintingReceipt] = useState(false);
  /** Cadastro rápido a partir da busca quando o produto ainda não existe. */
  const [quickOpen, setQuickOpen] = useState(false);

  const activeProducts = useMemo(
    () => products.filter((p) => (p.status ?? "active") === "active"),
    [products]
  );

  useEffect(() => {
    if (initialProductId && activeProducts.length && !product) {
      const p = activeProducts.find((x) => x.id === initialProductId);
      if (p) selectProduct(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId, activeProducts]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    const byConservation = conservationFilter === "all"
      ? activeProducts
      : conservationFilter === "produce"
        ? activeProducts.filter((p) => [p.category, p.name].filter(Boolean).join(" ").toLowerCase().includes("hortif"))
        : activeProducts.filter((p) => (p.conservation_method || "refrigerated") === conservationFilter);
    if (!s) return byConservation.slice(0, 24);
    return byConservation
      .filter((p) =>
        [p.name, p.brand, p.supplier_name, p.category].filter(Boolean).join(" ").toLowerCase().includes(s)
      )
      .slice(0, 24);
  }, [activeProducts, conservationFilter, search]);

  // Recebimento: todos os produtos da NF já vêm marcados para impressão.
  useEffect(() => {
    if (!receiptContext) return;
    setSelectedReceiptItems(receiptContext.items.map((i) => i.key));
    setReceiptQty(Object.fromEntries(receiptContext.items.map((i) => [i.key, Math.max(1, Math.round(i.quantity || 1))])));
    setReceiptWeight(
      Object.fromEntries(
        receiptContext.items.map((i) => [i.key, i.weight ? `${i.weight} ${i.weightUnit || "kg"}` : ""]),
      ),
    );
  }, [receiptContext?.receiptId]);

  useEffect(() => {
    if (!employeeId && activeEmployees.length) setEmployeeId(activeEmployees[0].id);
  }, [activeEmployees.length, employeeId]);

  /** Imprime etiquetas de PRODUTO LACRADO do recebimento: RECEBIDO EM + VAL. ORIGINAL.
   *  Nunca cria manipulação nem usa regra de pós-abertura. */
  const handlePrintReceipt = async () => {
    if (!receiptContext) return;
    const items = receiptContext.items.filter((i) => selectedReceiptItems.includes(i.key));
    if (!items.length) {
      toast.error("Selecione ao menos um produto");
      return;
    }
    const emp = activeEmployees.find((e) => e.id === employeeId) || activeEmployees[0] || null;
    if (!emp) {
      toast.error("Cadastre um responsável para imprimir");
      return;
    }
    setPrintingReceipt(true);
    const receivedAt = new Date();
    try {
      const sheets: PrintLabelData[] = [];
      for (const item of items) {
        const p = item.productId ? activeProducts.find((x) => x.id === item.productId) || null : null;
        const original = item.originalExpiry ? new Date(`${item.originalExpiry}T23:59:00`) : null;
        if (!original || isNaN(original.getTime())) {
          toast.error(`Informe a validade original de ${item.productName}`);
          setPrintingReceipt(false);
          return;
        }
        const count = Math.max(1, Math.min(50, receiptQty[item.key] || 1));
        const inserted = await createLabel({
          label_product_id: p?.id ?? null,
          product_name: p?.name || item.productName,
          manufacture_date: receivedAt,
          expiry_date: original,
          original_expiry_date: original,
          quantity: count,
          batch: item.batch,
          responsible: emp.name,
          employee_id: emp.id,
          conservation_method: (p?.conservation_method || "refrigerated") as any,
          notes: p?.default_observation || p?.notes || null,
          cif: p?.cif || null,
          allergens: p?.allergens || null,
          ingredients: p?.ingredients || null,
          supplier_lot: item.batch,
        });
        const qrSvg = renderToStaticMarkup(
          <QRCodeSVG value={`${getSiteBaseUrl()}/etiquetas/scan/${inserted.unique_code}?op=1`} size={144} level="L" marginSize={1} />
        );
        sheets.push({
          productName: p?.name || item.productName,
          manufactureDate: receivedAt,
          expiryDate: original,
          template: "received",
          responsible: emp.name,
          notes: p?.default_observation || p?.notes || null,
          cif: p?.cif || null,
          sif: p?.sif || null,
          inspectionType: (p as any)?.inspection_type || null,
          allergens: p?.allergens || null,
          ingredients: p?.ingredients || null,
          conservationLabel:
            CONSERVATION_LABEL[(p?.conservation_method || "refrigerated") as keyof typeof CONSERVATION_LABEL] || null,
          storageLocation: p?.storage_location || null,
          batch: item.batch,
          quantityWeight: (receiptWeight[item.key] || "").trim() || p?.default_weight || null,
          brand: [p?.brand, p?.supplier_name || receiptContext.supplierName].filter(Boolean).join(" / ") || null,
          restaurantName: restaurant?.name || null,
          restaurantLogoUrl: restaurant?.logo_url || null,
          restaurantCnpj: restaurantLegal?.cnpj || null,
          restaurantCep: restaurantLegal?.cep || null,
          checklistQrSvg: qrSvg,
          checklistQrLabel: `#${inserted.unique_code}`,
          quantity: count,
        });
      }
      printLabelsMany(sheets);
      toast.success(`${sheets.length} produto(s) enviados para impressão (lacrado)`);
      onClearReceiptContext?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao imprimir etiquetas do recebimento");
    } finally {
      setPrintingReceipt(false);
    }
  };

  const selectProduct = (p: LabelProduct) => {
    setProduct(p);
    setBatch("");
    setOriginalExpiry("");
    setQty(1);
    const parsed = parseDefaultWeight(p.default_weight);
    setAmount(parsed?.amount ?? "1");
    setAmountUnit(parsed?.unit ?? (p.unit || "un"));
    setNewCycle(
      endedCycles.find((cycle) => cycle.productId === p.id || (!cycle.productId && cycle.productName === p.name)) || null,
    );
    setEmployeeId(p.default_employee_id || employeeId || activeEmployees[0]?.id || "");
    setTimeout(() => batchRef.current?.focus(), 50);
  };

  const { data: restaurantLegal } = useQuery({
    queryKey: ["restaurant-legal", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .schema("mesaclik")
        .from("restaurants")
        .select("cnpj, zip_code")
        .eq("id", restaurant!.id)
        .maybeSingle();
      return { cnpj: data?.cnpj || null, cep: data?.zip_code || null };
    },
  });

  const now = useMemo(() => new Date(), [product, batch, originalExpiry]);

  /** Validade da etiqueta = agora + regra de validade após manipulação/abertura do cadastro. */
  const computedExpiry = useMemo(() => {
    if (!product) return null;
    const d = new Date();
    const unit = product.manipulation_validity_unit;
    const value = product.manipulation_validity_value;
    // Se existe prazo de pós-abertura cadastrado, ele é obrigatoriamente aplicado.
    if (unit === "immediate") {
      // Consumo imediato: validade = momento da manipulação.
    } else if (value && value > 0) {
      if (unit === "hours") {
        d.setHours(d.getHours() + value);
      } else if (unit === "months") {
        d.setMonth(d.getMonth() + value);
        d.setHours(23, 59, 0, 0);
      } else {
        d.setDate(d.getDate() + value);
        d.setHours(23, 59, 0, 0);
      }
    } else {
      d.setDate(d.getDate() + (product.validity_days || 1));
      d.setHours(23, 59, 0, 0);
    }
    // Nunca ultrapassar a validade original do fabricante.
    if (originalExpiry) {
      const orig = new Date(`${originalExpiry}T23:59:00`);
      if (!isNaN(orig.getTime()) && orig < d) return orig;
    }
    return d;
  }, [product, originalExpiry, now]);

  const employee = activeEmployees.find((e) => e.id === employeeId) || null;
  const canPrint = !!product && !!computedExpiry && !!employee && !submitting && (!newCycle || !!originalExpiry);

  const handlePrint = async () => {
    if (!product || !computedExpiry || !employee) return;
    setSubmitting(true);
    const manufacture = new Date();
    try {
      const count = Math.max(1, Math.min(50, qty));
      const inserted = await createLabel({
        label_product_id: product.id,
        product_name: product.name,
        manufacture_date: manufacture,
        expiry_date: computedExpiry,
        original_expiry_date: originalExpiry ? new Date(`${originalExpiry}T23:59:00`) : null,
        quantity: count,
        batch: batch.trim() || null,
        responsible: employee.name,
        employee_id: employee.id,
        conservation_method: (product.conservation_method || "refrigerated") as any,
        notes: product.default_observation || product.notes || null,
        cif: product.cif || null,
        allergens: product.allergens || null,
        ingredients: product.ingredients || null,
        supplier_lot: batch.trim() || null,
      });
      const qrSvg = renderToStaticMarkup(
        <QRCodeSVG value={`${getSiteBaseUrl()}/etiquetas/scan/${inserted.unique_code}?op=1`} size={144} level="L" marginSize={1} />
      );
      printLabels({
        productName: product.name,
        manufactureDate: manufacture,
        expiryDate: computedExpiry,
        originalExpiryDate: originalExpiry ? new Date(`${originalExpiry}T23:59:00`) : null,
        template: "manipulation",
        responsible: employee.name,
        notes: product.default_observation || product.notes || null,
        cif: product.cif || null,
        sif: product.sif || null,
        inspectionType: (product as any).inspection_type || null,
        allergens: product.allergens || null,
        ingredients: product.ingredients || null,
        conservationLabel:
          CONSERVATION_LABEL[(product.conservation_method || "refrigerated") as keyof typeof CONSERVATION_LABEL] || null,
        storageLocation: product.storage_location || null,
        batch: batch.trim() || null,
        quantityWeight: amount.trim() ? `${amount.trim()} ${amountUnit}` : product.default_weight || null,
        brand: [product.brand, product.supplier_name].filter(Boolean).join(" / ") || null,
        restaurantName: restaurant?.name || null,
        restaurantLogoUrl: restaurant?.logo_url || null,
        restaurantCnpj: restaurantLegal?.cnpj || null,
        restaurantCep: restaurantLegal?.cep || null,
        checklistQrSvg: qrSvg,
        checklistQrLabel: `#${inserted.unique_code}`,
        quantity: count,
      });
      toast.success(`${count} etiqueta(s) de ${product.name} enviadas para impressão`);
      // Encerra a emissão anterior preservando o histórico do produto.
      if (newCycle?.labelIds?.length) {
        await (supabase as any)
          .from("label_issuances")
          .update({ status: "discharged", discharge_reason: "vencimento", resolved_at: manufacture.toISOString() })
          .in("id", newCycle.labelIds);
        toast.success("Ciclo anterior encerrado e mantido no histórico");
      }
      setNewCycle(null);
      setBatch("");
      setOriginalExpiry("");
      setQty(1);
      setTimeout(() => batchRef.current?.focus(), 50);
    } catch (e: any) {
      toast.error(e.message || "Erro ao imprimir");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="hidden flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 md:flex">
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary shrink-0" /> Impressão rápida
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">Produto → Lote → Validade original → Imprimir.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onManageProducts} className="self-start sm:self-auto shrink-0">
          <Package className="h-4 w-4" /> Cadastro
        </Button>
      </div>


      {receiptContext && (
        <Card className="p-4 border-primary/40 bg-primary/[0.06] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Truck className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="font-bold">
                  Etiquetas do recebimento
                  {receiptContext.reference ? ` · NF ${receiptContext.reference}` : ""}
                </div>
                <p className="text-xs text-muted-foreground">
                  Produto <strong>lacrado</strong>: a etiqueta usa a validade original do fabricante. Sem manipulação e sem pós-abertura.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClearReceiptContext}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-2">
            {receiptContext.items.map((i) => {
              const checked = selectedReceiptItems.includes(i.key);
              return (
                <div key={i.key} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setSelectedReceiptItems((prev) => (v ? [...prev, i.key] : prev.filter((k) => k !== i.key)))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{i.productName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      <strong className="text-foreground">{i.quantity} {i.unit || "un"}</strong> · lote {i.batch || "—"} · val. original{" "}
                      {i.originalExpiry ? format(new Date(`${i.originalExpiry}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "informar"}
                    </div>
                  </div>
                  <Input
                    value={receiptWeight[i.key] ?? ""}
                    onChange={(e) => setReceiptWeight((prev) => ({ ...prev, [i.key]: e.target.value }))}
                    placeholder="Peso"
                    className="h-10 w-24"
                    title="Peso da embalagem (vem da NF, editável)"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={receiptQty[i.key] ?? 1}
                    onChange={(e) =>
                      setReceiptQty((prev) => ({ ...prev, [i.key]: Math.max(1, Math.min(50, Number(e.target.value) || 1)) }))
                    }
                    className="h-10 w-20"
                  />
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handlePrintReceipt} disabled={printingReceipt} size="lg" className="w-full h-12 font-bold gap-2">
            {printingReceipt ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
            IMPRIMIR ETIQUETAS LACRADAS
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Lista de produtos */}
        <Card className={cn("order-2 space-y-2.5 bg-card/40 p-2.5 md:space-y-3 md:p-4 lg:order-1", product && "max-md:hidden")}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus={typeof window !== "undefined" && !("ontouchstart" in window)}
              placeholder="Buscar produto (nome, marca, fornecedor)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-9 text-base md:h-12"
            />
          </div>
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
            {[
              ["all", "Todos"],
              ["ambient", "Ambiente"],
              ["refrigerated", "Refrigerado"],
              ["frozen", "Congelado"],
               ["produce", "Hortifruti"],
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={conservationFilter === value ? "default" : "outline"}
                onClick={() => setConservationFilter(value)}
                className="h-9 shrink-0 px-3"
              >
                {label}
              </Button>
            ))}
          </div>
          {search.trim() && filtered.length > 0 && (
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="w-full text-left text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
            >
              Não achou "{search.trim()}"? Cadastre em segundos e imprima.
            </button>
          )}
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-muted-foreground">
                Nenhum produto encontrado{search.trim() ? <> para <strong>"{search.trim()}"</strong></> : null}.
              </p>
              <Button onClick={() => setQuickOpen(true)} className="h-11">
                <Plus className="h-4 w-4" /> Cadastrar e imprimir agora
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">

              {filtered.map((p) => {
                const active = product?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors md:min-h-16 md:gap-3 md:px-3 md:py-2.5",
                      active
                        ? "bg-primary/10"
                        : "bg-card/40 hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                       "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border md:h-10 md:w-10",
                      active ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground",
                    )}>
                      {active ? <Check className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[p.brand, p.supplier_name, p.category].filter(Boolean).join(" · ") || "Sem marca"}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {CONSERVATION_LABEL[(p.conservation_method || "refrigerated") as keyof typeof CONSERVATION_LABEL]}
                        {p.storage_location ? ` · ${p.storage_location}` : ""}
                      </div>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Painel de impressão */}
        <Card className={cn(
          "h-fit space-y-3 bg-card/40 p-3 md:space-y-4 md:p-4 lg:sticky lg:top-4 lg:order-2",
          product ? "order-1 max-md:-mx-3 max-md:rounded-none max-md:border-x-0 max-md:bg-transparent max-md:pb-36" : "order-3 max-md:hidden lg:order-2"
        )}>
          {!product ? (
            <div className="text-center py-14 text-sm text-muted-foreground">
              Selecione um produto para imprimir.
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                {isMobile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Voltar para produtos"
                    onClick={() => setProduct(null)}
                    className="h-11 w-11 shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase text-muted-foreground font-bold">Produto</div>
                <div className="text-lg font-bold leading-tight">{product.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[product.brand, product.supplier_name, product.sif ? `${(product as any).inspection_type === "SISP" ? "SISP" : (product as any).inspection_type === "IMPORTADO" ? "REG." : "SIF"} ${product.sif}` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fp-batch">Lote</Label>
                <Input
                  id="fp-batch"
                  ref={batchRef}
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  placeholder="Lote do fabricante"
                  maxLength={40}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="fp-orig">Validade original</Label>
                <Input
                  id="fp-orig"
                  type="date"
                  value={originalExpiry}
                  onChange={(e) => setOriginalExpiry(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="fp-amount">Quantidade (peso ou unidades)</Label>
                <div className="flex gap-2">
                  <Input
                    id="fp-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    className="h-12 text-base flex-1"
                  />
                  <Select value={amountUnit} onValueChange={setAmountUnit}>
                    <SelectTrigger className="h-12 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AMOUNT_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Preenchido pelo cadastro do produto — ajuste se necessário.
                </p>
              </div>

              <div className="space-y-1">
                <Label>Responsável</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <span className="text-sm font-semibold">Etiquetas</span>
                <div className="flex items-center gap-3">
                  <Button type="button" size="icon" variant="outline" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</Button>
                  <span className="text-lg font-bold w-8 text-center">{qty}</span>
                  <Button type="button" size="icon" variant="outline" onClick={() => setQty((q) => Math.min(50, q + 1))}>+</Button>
                </div>
              </div>

              {computedExpiry && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Manipulação</span>
                    <span className="font-semibold">{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Validade da etiqueta</span>
                    <span className="font-bold text-primary">{format(computedExpiry, "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              )}

              {computedExpiry && employee && (
                <LabelPrintPreview
                  productName={product.name}
                  conservationLabel={CONSERVATION_LABEL[(product.conservation_method || "refrigerated") as keyof typeof CONSERVATION_LABEL]}
                  quantityWeight={amount.trim() ? `${amount.trim()} ${amountUnit}` : product.default_weight}
                  originalExpiryDate={originalExpiry ? new Date(`${originalExpiry}T23:59:00`) : null}
                  manipulationDate={now}
                  expiryDate={computedExpiry}
                  batch={batch.trim() || null}
                  storageLocation={product.storage_location}
                  brand={[product.brand, product.supplier_name].filter(Boolean).join(" / ") || null}
                  responsible={employee.name}
                  restaurantName={restaurant?.name}
                  allergens={product.allergens}
                />
              )}

              <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-md:z-50 max-md:border-t max-md:border-border max-md:bg-background max-md:p-2.5">
                <Button onClick={handlePrint} disabled={!canPrint} size="lg" className="h-12 w-full text-sm font-bold shadow-lg">
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                  IMPRIMIR ETIQUETA
                </Button>
              </div>
              {!employee && (
                <p className="text-[11px] text-amber-500 text-center">Cadastre/selecione um responsável para imprimir.</p>
              )}
            </>
          )}
        </Card>
      </div>

      <ProductFormDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        product={null}
        initialName={search.trim()}
        submitLabel="Cadastrar e usar"
        isSubmitting={isMutating}
        onSubmit={async (input) => {
          const created = await createProduct(input);
          if (created) {
            setSearch("");
            selectProduct(created as LabelProduct);
            toast.success("Produto cadastrado. Informe o lote e imprima.");
          }
        }}
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Search, Loader2, Zap, Check, Package, AlertTriangle, Truck, X } from "lucide-react";
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
  const { products, isLoading } = useLabelProducts();
  const { activeEmployees } = useLabelEmployees();
  const { createLabel } = useLabels();
  const { restaurant } = useRestaurant();
  const { endedCycles } = useLabelRenewals();

  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<LabelProduct | null>(null);
  const [batch, setBatch] = useState("");
  const [originalExpiry, setOriginalExpiry] = useState("");
  const [qty, setQty] = useState(1);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  /** Ciclo anterior encerrado que está sendo reetiquetado (novo valor original + novo lote). */
  const [newCycle, setNewCycle] = useState<EndedCycleProduct | null>(null);
  const [selectedEnded, setSelectedEnded] = useState<string[]>([]);
  const batchRef = useRef<HTMLInputElement>(null);
  /** Itens do recebimento selecionados para impressão (pré-selecionados conforme a NF). */
  const [selectedReceiptItems, setSelectedReceiptItems] = useState<string[]>([]);
  const [receiptQty, setReceiptQty] = useState<Record<string, number>>({});
  const [printingReceipt, setPrintingReceipt] = useState(false);

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
    if (!s) return activeProducts.slice(0, 24);
    return activeProducts
      .filter((p) =>
        [p.name, p.brand, p.supplier_name, p.category].filter(Boolean).join(" ").toLowerCase().includes(s)
      )
      .slice(0, 24);
  }, [activeProducts, search]);

  // Produtos com validade original atingida vêm pré-selecionados.
  useEffect(() => {
    setSelectedEnded(endedCycles.map((c) => c.productId || c.productName));
  }, [endedCycles.length]);

  // Recebimento: todos os produtos da NF já vêm marcados para impressão.
  useEffect(() => {
    if (!receiptContext) return;
    setSelectedReceiptItems(receiptContext.items.map((i) => i.key));
    setReceiptQty(Object.fromEntries(receiptContext.items.map((i) => [i.key, Math.max(1, Math.round(i.quantity || 1))])));
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
          quantityWeight: p?.default_weight || null,
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

  /** Inicia um NOVO CICLO: novo lote gerado + novo valor original obrigatório. */
  const startNewCycle = async (c: EndedCycleProduct) => {
    const p = activeProducts.find((x) => x.id === c.productId) || activeProducts.find((x) => x.name === c.productName);
    if (!p) {
      toast.error("Produto não encontrado no cadastro");
      return;
    }
    selectProduct(p);
    setNewCycle(c);
    setBatch("");
    setOriginalExpiry("");
    toast.info("Novo ciclo: informe o lote e o novo valor original (validade do fabricante).");
    setTimeout(() => batchRef.current?.focus(), 50);
  };

  const selectProduct = (p: LabelProduct) => {
    setProduct(p);
    setBatch("");
    setOriginalExpiry("");
    setQty(1);
    setNewCycle(null);
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
    if (product.manipulation_enabled && value && value > 0) {
      if (unit === "hours") d.setHours(d.getHours() + value);
      else if (unit === "months") d.setMonth(d.getMonth() + value);
      else d.setDate(d.getDate() + value);
    } else {
      d.setDate(d.getDate() + (product.validity_days || 1));
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
        quantityWeight: product.default_weight || null,
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
      // Novo ciclo: encerra o ciclo anterior preservando o histórico.
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Impressão rápida
          </h2>
          <p className="text-sm text-muted-foreground">Produto → Lote → Validade original → Imprimir.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onManageProducts}>
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
                      {i.quantity} {i.unit || "un"} · lote {i.batch || "—"} · val. original{" "}
                      {i.originalExpiry ? format(new Date(`${i.originalExpiry}T12:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "informar"}
                    </div>
                  </div>
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

      {endedCycles.length > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/[0.05] space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <div className="font-bold text-destructive">Produtos com validade original atingida</div>
              <p className="text-xs text-muted-foreground">
                Estes produtos encerraram o ciclo original e precisam iniciar um <strong>novo ciclo</strong> de
                etiquetagem (novo lote + novo valor original). O histórico anterior é preservado.
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            {endedCycles.map((c) => {
              const key = c.productId || c.productName;
              const checked = selectedEnded.includes(key);
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setSelectedEnded((prev) => (v ? [...prev, key] : prev.filter((k) => k !== key)))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{c.productName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Ciclo anterior · lote {c.previousLot || "—"} · valor original{" "}
                      {c.previousOriginalExpiry ? format(c.previousOriginalExpiry, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </div>
                  </div>
                  <Button size="sm" variant="destructive" disabled={!checked} onClick={() => startNewCycle(c)}>
                    Novo ciclo
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Lista de produtos */}
        <Card className="p-3 md:p-4 bg-card/40 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar produto (nome, marca, fornecedor)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-12 text-base"
            />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhum produto encontrado. Cadastre o produto uma única vez em <strong>Produtos</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[62vh] overflow-y-auto pr-1">
              {filtered.map((p) => {
                const active = product?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      active
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/50 bg-card/40 hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold truncate flex-1">{p.name}</span>
                      {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {[p.brand, p.supplier_name].filter(Boolean).join(" · ") || "Sem marca"}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {CONSERVATION_LABEL[(p.conservation_method || "refrigerated") as keyof typeof CONSERVATION_LABEL]}
                      {p.storage_location ? ` · ${p.storage_location}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Painel de impressão */}
        <Card className="p-4 bg-card/40 space-y-4 h-fit lg:sticky lg:top-4">
          {!product ? (
            <div className="text-center py-14 text-sm text-muted-foreground">
              Selecione um produto para imprimir.
            </div>
          ) : (
            <>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground font-bold">Produto</div>
                <div className="text-lg font-bold leading-tight">{product.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[product.brand, product.supplier_name, product.sif ? `${(product as any).inspection_type === "SISP" ? "SISP" : (product as any).inspection_type === "IMPORTADO" ? "REG." : "SIF"} ${product.sif}` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fp-batch">Lote {newCycle && <span className="text-destructive text-[11px]">(novo ciclo)</span>}</Label>
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
                <Label htmlFor="fp-orig">
                  Valor original {newCycle && <span className="text-destructive text-[11px]">obrigatório no novo ciclo</span>}
                </Label>
                <Input
                  id="fp-orig"
                  type="date"
                  value={originalExpiry}
                  onChange={(e) => setOriginalExpiry(e.target.value)}
                  className="h-12 text-base"
                />
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

              <Button onClick={handlePrint} disabled={!canPrint} size="lg" className="w-full h-14 text-base font-bold">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                IMPRIMIR
              </Button>
              {!employee && (
                <p className="text-[11px] text-amber-500 text-center">Cadastre/selecione um responsável para imprimir.</p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

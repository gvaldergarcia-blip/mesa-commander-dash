import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChefHat, Loader2, Truck, Calendar, Tag, ArrowRight, AlertTriangle, Clock, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLabels } from "@/hooks/useLabels";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { useLabeledProducts } from "@/hooks/useLabeledProducts";
import { useLabelProducts } from "@/hooks/useLabelProducts";
import { printLabels } from "@/components/labels/LabelPrintSheet";
import { useRestaurant } from "@/hooks/useRestaurantContext";
import { useRestaurant as useRestaurantCtx } from "@/contexts/RestaurantContext";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { getSiteBaseUrl } from "@/config/site-url";

interface ActiveLot {
  issuance_id: string;
  batch: string | null;
  supplier_lot: string | null;
  traceability_lot: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  receipt_id: string | null;
  received_at: string | null;
  expiry_date: string | null;
  units_remaining: number;
}

function fmtDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Janela usada quando a embalagem manda "consumir imediatamente após aberto".
 *  A etiqueta é impressa com o aviso CONSUMO IMEDIATO; a validade técnica é
 *  curta apenas para o controle interno de vencimento. */
const IMMEDIATE_HOURS = 2;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string | null;
  productName: string;
  conservationMethod?: string | null;
}

export function ManipulationDialog({ open, onOpenChange, productId, productName, conservationMethod }: Props) {
  const { createLabel } = useLabels();
  const { activeEmployees } = useLabelEmployees();
  const { items: labeledProducts } = useLabeledProducts();
  const { products: labelProducts } = useLabelProducts();
  const { restaurant } = (useRestaurant() as any) || { restaurant: null };
  const { restaurant: restaurantCtx } = useRestaurantCtx();

  const [selectedProductId, setSelectedProductId] = useState<string>(productId ?? "");
  const [selectedProductName, setSelectedProductName] = useState<string>(productName ?? "");
  // Quando o produto não tem lote ativo, o operador informa o lote aqui mesmo.
  const [forceManualOrigin, setForceManualOrigin] = useState(false);

  const [loadingLots, setLoadingLots] = useState(false);
  const [lots, setLots] = useState<ActiveLot[]>([]);
  const [lotId, setLotId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Preenchimento manual quando o dado necessário não existe no recebimento
  const [manualExpiryAt, setManualExpiryAt] = useState<string>("");
  const [manualOriginBatch, setManualOriginBatch] = useState<string>("");
  const [manualOriginExpiry, setManualOriginExpiry] = useState<string>("");
  const [manualWeight, setManualWeight] = useState<string>("");
  const [manualSif, setManualSif] = useState<string>("");
  // Após registrar, guardamos o payload da etiqueta para o operador decidir imprimir.
  const [printPayload, setPrintPayload] = useState<any | null>(null);
  const [doneBatch, setDoneBatch] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    // Reset ao abrir
    setSelectedProductId(productId ?? "");
    setSelectedProductName(productName ?? "");
    setForceManualOrigin(false);
    setLotId("");
    setLots([]);
    setNotes("");
    setManualExpiryAt("");
    setManualOriginBatch("");
    setManualOriginExpiry("");
    setManualWeight("");
    setManualSif("");
    setPrintPayload(null);
    setDoneBatch("");
  }, [open, productId, productName]);

  // Busca lotes ativos sempre que o produto selecionado mudar
  useEffect(() => {
    if (!open || !selectedProductId) { setLots([]); setLotId(""); return; }
    setLoadingLots(true);
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("label_active_lots_for_product", {
          _product_id: selectedProductId,
        });
        if (error) throw error;
        const rows = (data || []) as ActiveLot[];
        setLots(rows);
        if (rows.length === 1) setLotId(rows[0].issuance_id);
      } catch (e: any) {
        toast.error(e.message || "Erro ao buscar lotes ativos");
      } finally {
        setLoadingLots(false);
      }
    })();
  }, [open, selectedProductId]);

  const selectedLot = useMemo(() => lots.find((l) => l.issuance_id === lotId) || null, [lots, lotId]);
  const productsForSelect = useMemo(
    () => (labeledProducts || []).filter((p: any) => p.product_id).slice(0, 500),
    [labeledProducts],
  );

  // Regra de validade após manipulação — vem do cadastro do produto (POPs do estabelecimento).
  // O MesaClik NÃO define validade, apenas aplica a configuração previamente definida.
  const productConfig = useMemo(
    () => (selectedProductId ? labelProducts.find((p) => p.id === selectedProductId) : null),
    [labelProducts, selectedProductId],
  );
  const manipulationRule = useMemo(() => {
    if (productConfig?.manipulation_enabled) {
      const v = Number(productConfig.manipulation_validity_value || 0);
      const u = productConfig.manipulation_validity_unit;
      if (u === "immediate") {
        return { value: 1, unit: "immediate" as const, manual: false };
      }
      if (v && (u === "hours" || u === "days" || u === "months")) {
        return { value: v, unit: u as "hours" | "days" | "months" | "immediate", manual: false };
      }
    }
    return null;
  }, [productConfig]);
  // A validade SEMPRE parte da data/hora da manipulação (nunca da validade original).
  const computedExpiry = useMemo(() => {
    if (manipulationRule) {
      const base = new Date();
      if (manipulationRule.unit === "immediate") {
        return new Date(base.getTime() + IMMEDIATE_HOURS * 3600_000);
      }
      if (manipulationRule.unit === "months") {
        const d = new Date(base);
        d.setMonth(d.getMonth() + manipulationRule.value);
        return d;
      }
      const ms = manipulationRule.unit === "hours"
        ? manipulationRule.value * 3600_000
        : manipulationRule.value * 86_400_000;
      return new Date(base.getTime() + ms);
    }
    if (manualExpiryAt) {
      const d = new Date(manualExpiryAt);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }, [manipulationRule, manualExpiryAt]);
  const isImmediateRule = manipulationRule?.unit === "immediate";
  const configuredRule = !!manipulationRule;
  const missingConfig = !!selectedProductId && !configuredRule;
  const manualOriginMode = !!selectedProductId && (forceManualOrigin || (!loadingLots && lots.length === 0));
  // Dados que o recebimento pode não ter informado
  const lotMissingBatch = manualOriginMode
    || (!!selectedLot && !(selectedLot.supplier_lot || selectedLot.traceability_lot || selectedLot.batch));
  const lotMissingExpiry = manualOriginMode || (!!selectedLot && !selectedLot.expiry_date);

  const confirm = async () => {
    if (!employeeId) return toast.error("Selecione o responsável");
    const manufacture = new Date();

    if (!selectedProductId) return toast.error("Selecione o produto");
    if (!manualOriginMode && !selectedLot) return toast.error("Selecione o lote de origem");
    if (!computedExpiry) return toast.error("Informe a validade da manipulação para continuar.");
    if (lotMissingBatch && !manualOriginBatch.trim()) return toast.error("Informe o lote do produto");
    const expiry = computedExpiry;
    if (expiry <= manufacture) return toast.error("Validade calculada inválida");

    // Novo lote interno MAN-YYYYMMDD-NNN
    let batch = `MAN-${Date.now().toString(36).toUpperCase()}`;
    try {
      const { data: gen } = await (supabase as any).rpc("label_generate_manipulation_lot");
      if (typeof gen === "string" && gen) batch = gen;
    } catch { /* fallback local */ }

    const employee = activeEmployees.find((e) => e.id === employeeId);
    const originLabel = selectedLot
      ? (selectedLot.supplier_lot || selectedLot.traceability_lot || selectedLot.batch || manualOriginBatch.trim() || "—")
      : (manualOriginBatch.trim() || "—");
    const originSupplier = selectedLot?.supplier_name || null;
    // Validade original do fabricante: apenas rastreabilidade, nunca base de cálculo.
    const originExpiry = selectedLot?.expiry_date
      ? new Date(selectedLot.expiry_date)
      : (manualOriginExpiry ? new Date(`${manualOriginExpiry}T23:59:00`) : null);
    const finalProductName = selectedProductName;
    const originNote = notes.trim() ? notes.trim() : null;
    const originTag = "Recebimento";

    setSaving(true);
    try {
      const inserted: any = await createLabel({
        label_product_id: selectedProductId,
        product_name: finalProductName,
        manufacture_date: manufacture,
        expiry_date: expiry,
        quantity: 1,
        batch,
        responsible: employee?.name || null,
        employee_id: employee?.id || null,
        conservation_method: (conservationMethod as any) || "refrigerated",
        notes: originNote ? `[${originTag}] ${originNote}` : `[${originTag}]`,
        origin_issuance_id: selectedLot?.issuance_id ?? null,
        // supplier_id, supplier_lot e origin_traceability_lot vêm por trigger
      });
      toast.success(`Manipulação registrada · Lote ${batch}`);
      // Busca dados legais e SIF/peso/local herdados via trigger para imprimir
      // a etiqueta completa (mesma estrutura das etiquetas normais + faixa "MANIPULADO").
      try {
        let legal: { cnpj: string | null; cep: string | null; address: string | null } = {
          cnpj: (restaurant as any)?.cnpj ?? null,
          cep: (restaurant as any)?.cep ?? null,
          address: (restaurantCtx as any)?.address_line ?? null,
        };
        if (restaurantCtx?.id) {
          const { data: r } = await (supabase as any)
            .schema("mesaclik")
            .from("restaurants")
            .select("cnpj, zip_code, address_line")
            .eq("id", restaurantCtx.id)
            .maybeSingle();
          if (r) legal = {
            cnpj: r.cnpj || legal.cnpj,
            cep: r.zip_code || legal.cep,
            address: r.address_line || legal.address,
          };
        }
        // Recarrega a issuance criada para obter unique_code, sif, weight, storage_location
        // — herdados via trigger a partir do lote de origem.
        let full: any = inserted || {};
        if (inserted?.id) {
          const { data: row } = await (supabase as any)
            .from("label_issuances")
            .select("*")
            .eq("id", inserted.id)
            .maybeSingle();
          if (row) full = row;
        }
        const qrSvg = full.unique_code
          ? renderToStaticMarkup(
              <QRCodeSVG
                value={`${getSiteBaseUrl()}/etiquetas/scan/${full.unique_code}?op=1`}
                size={144}
                level="L"
                marginSize={1}
              />,
            )
          : null;
        const weightLabel = full.weight != null && full.weight_unit
          ? `${String(full.weight).replace(".", ",")} ${full.weight_unit}`
          : (manualWeight.trim() || null);
        const consMap: Record<string, string> = {
          refrigerated: "REFRIGERADO", frozen: "CONGELADO", ambient: "AMBIENTE", hot: "QUENTE",
        };
        setPrintPayload({
          productName: finalProductName,
          manufactureDate: manufacture,
          expiryDate: expiry,
          originalExpiryDate: originExpiry,
          responsible: employee?.name || full.responsible || "—",
          quantity: 1,
          batch,
          template: "manipulation",
          brand: originSupplier,
          sif: full.sif ?? (manualSif.trim() || null),
          notes: [
            isImmediateRule ? "CONSUMO IMEDIATO APÓS ABERTURA" : null,
            `Origem: ${originSupplier || "—"} · Lote ${originLabel}`,
            originNote,
          ].filter(Boolean).join(" · "),
          conservationLabel: consMap[full.conservation_method || (conservationMethod as any) || "refrigerated"] || null,
          storageLocation: full.storage_location ?? null,
          quantityWeight: weightLabel,
          restaurantName: restaurantCtx?.name ?? null,
          restaurantCnpj: legal.cnpj,
          restaurantCep: legal.cep,
          restaurantAddress: legal.address,
          checklistQrSvg: qrSvg,
          checklistQrLabel: full.unique_code ? `#${full.unique_code}` : null,
        });
      } catch (e) {
        console.error("[ManipulationDialog] print", e);
      }
      setDoneBatch(batch);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar manipulação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" /> Manipular produto
          </DialogTitle>
          <DialogDescription>
            Imprima a etiqueta no momento em que a embalagem for aberta. O sistema usa a
            data/hora da impressão + a regra após abertura capturada no recebimento para
            calcular a validade. Novo lote interno <span className="font-mono">MAN-…</span>.
          </DialogDescription>
        </DialogHeader>

        {doneBatch ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" /> Manipulação registrada
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedProductName} · Lote <span className="font-mono">{doneBatch}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Deseja imprimir a etiqueta desta manipulação agora?
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar sem imprimir</Button>
              <Button
                className="gap-2"
                disabled={!printPayload}
                onClick={() => { if (printPayload) printLabels(printPayload); }}
              >
                Imprimir etiqueta
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className={selectedProductId ? "" : "text-muted-foreground"}>
                    {selectedProductName || "Buscar produto…"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-[--radix-popover-trigger-width]"
                align="start"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <Command>
                  <CommandInput placeholder="Digite o nome do produto…" />
                  <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {productsForSelect.map((p: any) => (
                        <CommandItem
                          key={p.product_id}
                          value={p.product_name}
                          onSelect={() => {
                            setSelectedProductId(p.product_id);
                            setSelectedProductName(p.product_name ?? "");
                            setProductOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${selectedProductId === p.product_id ? "opacity-100" : "opacity-0"}`}
                          />
                          {p.product_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Lote de origem</Label>
            {loadingLots ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando lotes ativos…
              </div>
            ) : !selectedProductId ? (
              <p className="text-xs text-muted-foreground">Selecione o produto para carregar os lotes.</p>
            ) : lots.length === 0 ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">
                  Nenhum lote ativo encontrado. Informe o lote do produto abaixo para seguir com a impressão.
                </p>
                <Input
                  value={manualOriginBatch}
                  onChange={(e) => setManualOriginBatch(e.target.value)}
                  placeholder="Lote do produto (ex.: L2026-07)"
                />
              </div>
            ) : (
              <Select value={lotId} onValueChange={setLotId}>
                <SelectTrigger><SelectValue placeholder="Selecionar lote…" /></SelectTrigger>
                <SelectContent>
                  {lots.map((l) => (
                    <SelectItem key={l.issuance_id} value={l.issuance_id}>
                      {(l.supplier_lot || l.traceability_lot || l.batch || "—")}
                      {" · "}{l.supplier_name || "MesaClik"}
                      {" · "}{l.units_remaining} un
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedLot && (
              <div className="rounded-lg border bg-muted/30 p-2.5 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{selectedLot.supplier_name || "—"}</span>
                <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{selectedLot.supplier_lot || selectedLot.traceability_lot}</span>
                {selectedLot.expiry_date && (
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Val. orig.: {new Date(selectedLot.expiry_date).toLocaleDateString("pt-BR")}</span>
                )}
                {selectedLot.traceability_lot && selectedLot.supplier_lot && selectedLot.supplier_lot !== selectedLot.traceability_lot && (
                  <Badge variant="outline" className="text-[10px]">{selectedLot.traceability_lot}</Badge>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {manipulationRule && computedExpiry && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <Clock className="h-3.5 w-3.5" /> Regra aplicada
              </div>
              <div>
                {isImmediateRule ? (
                  <>✓ Consumo imediato após abertura — impressa em {fmtDateTime(new Date())}</>
                ) : (
                  <>
                    ✓ {manipulationRule.value}{" "}
                    {manipulationRule.unit === "hours" ? "hora(s)" : manipulationRule.unit === "months" ? "mês(es)" : "dia(s)"} de uso
                    {" "}a partir de {fmtDateTime(new Date())}
                  </>
                )}
              </div>
              <div className="text-muted-foreground">
                Nova validade calculada: <span className="font-semibold text-foreground">{fmtDateTime(computedExpiry)}</span>
              </div>
              {selectedLot?.expiry_date && (
                <div className="text-[10px] text-muted-foreground">
                  Val. original do fabricante: {new Date(selectedLot.expiry_date).toLocaleDateString("pt-BR")} (apenas rastreabilidade)
                </div>
              )}
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-emerald-500/20 mt-1">
                Regra identificada no recebimento/cadastro do produto. A validade é calculada sempre a partir da data e hora da manipulação.
              </p>
            </div>
          )}
          {missingConfig && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Produto sem regra de validade cadastrada
              </div>
              <p className="text-muted-foreground">
                Informe a data e hora exata em que este produto deixa de poder ser usado (conforme seus POPs).
              </p>
              <div className="space-y-1 pt-1">
                <Label className="text-[11px]">Validade (data e hora do fim do uso) *</Label>
                <Input
                  type="datetime-local"
                  value={manualExpiryAt}
                  onChange={(e) => setManualExpiryAt(e.target.value)}
                />
                {computedExpiry && (
                  <p className="text-[10px] text-muted-foreground">
                    Manipulação: {fmtDateTime(new Date())} · Validade: {fmtDateTime(computedExpiry)}
                  </p>
                )}
              </div>
            </div>
          )}

          {selectedLot && (lotMissingBatch || lotMissingExpiry) && (
            <div className="rounded-lg border border-dashed p-3 space-y-3 text-xs">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Dados ausentes no recebimento
              </div>
              <p className="text-[11px] text-muted-foreground">
                O lote/validade não foi informado no recebimento. Preencha abaixo e a impressão segue normalmente.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {lotMissingBatch && (
                  <div className="space-y-1">
                    <Label className="text-[11px]">Lote original *</Label>
                    <Input value={manualOriginBatch} onChange={(e) => setManualOriginBatch(e.target.value)} placeholder="Ex.: L2026-07" />
                  </div>
                )}
                {lotMissingExpiry && (
                  <div className="space-y-1">
                    <Label className="text-[11px]">Validade original (opcional)</Label>
                    <Input type="date" value={manualOriginExpiry} onChange={(e) => setManualOriginExpiry(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {!!selectedProductId && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Peso (opcional)</Label>
                <Input value={manualWeight} onChange={(e) => setManualWeight(e.target.value)} placeholder="500 g / 1 kg" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">SIF/SISP (opcional)</Label>
                <Input value={manualSif} onChange={(e) => setManualSif(e.target.value)} placeholder="Se não veio no recebimento" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: porcionado, higienizado…" />
          </div>
          {selectedLot && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs flex items-center gap-2">
              <span className="font-mono">{selectedLot.supplier_lot || selectedLot.traceability_lot}</span>
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-primary font-semibold">MAN-…</span>
              <span className="text-muted-foreground ml-auto">Rastreabilidade preservada</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            onClick={confirm}
            disabled={
              saving || !employeeId ||
              !selectedProductId || !computedExpiry ||
              (!manualOriginMode && !selectedLot) ||
              (lotMissingBatch && !manualOriginBatch.trim())
            }
            className="gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar manipulação
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
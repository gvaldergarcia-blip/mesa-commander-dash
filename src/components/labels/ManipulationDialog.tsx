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
import { ChefHat, Loader2, Truck, Calendar, Tag, ArrowRight, AlertTriangle, Clock } from "lucide-react";
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

  // Modo: "linked" = a partir de um lote recebido; "direct" = manipulação direta.
  const [mode, setMode] = useState<"linked" | "direct">(productId ? "linked" : "linked");
  const [selectedProductId, setSelectedProductId] = useState<string>(productId ?? "");
  const [selectedProductName, setSelectedProductName] = useState<string>(productName ?? "");
  const [directName, setDirectName] = useState<string>("");
  const [directWeight, setDirectWeight] = useState<string>("");
  const [directOriginBatch, setDirectOriginBatch] = useState<string>("");
  const [directOriginExpiry, setDirectOriginExpiry] = useState<string>("");

  const [loadingLots, setLoadingLots] = useState(false);
  const [lots, setLots] = useState<ActiveLot[]>([]);
  const [lotId, setLotId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset ao abrir
    setMode(productId ? "linked" : "linked");
    setSelectedProductId(productId ?? "");
    setSelectedProductName(productName ?? "");
    setDirectName("");
    setDirectWeight("");
    setDirectOriginBatch("");
    setDirectOriginExpiry("");
    setLotId("");
    setLots([]);
    setNotes("");
  }, [open, productId, productName]);

  // Busca lotes ativos sempre que o produto selecionado mudar no modo "linked"
  useEffect(() => {
    if (!open || mode !== "linked" || !selectedProductId) { setLots([]); setLotId(""); return; }
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
  }, [open, mode, selectedProductId]);

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
    if (mode !== "linked") return null;
    if (!productConfig?.manipulation_enabled) return null;
    const v = Number(productConfig.manipulation_validity_value || 0);
    const u = productConfig.manipulation_validity_unit;
    if (!v || (u !== "hours" && u !== "days")) return null;
    return { value: v, unit: u as "hours" | "days" };
  }, [mode, productConfig]);
  const computedExpiry = useMemo(() => {
    const base = new Date();
    if (!manipulationRule) return null;
    const ms = manipulationRule.unit === "hours"
      ? manipulationRule.value * 3600_000
      : manipulationRule.value * 86_400_000;
    return new Date(base.getTime() + ms);
  }, [manipulationRule]);
  const missingConfig = mode === "linked" && !!selectedProductId && !manipulationRule;

  const confirm = async () => {
    if (!employeeId) return toast.error("Selecione o responsável");
    const manufacture = new Date();

    // Validação por modo
    if (mode === "linked") {
      if (!selectedProductId) return toast.error("Selecione o produto");
      if (!selectedLot) return toast.error("Selecione o lote de origem");
      if (!manipulationRule || !computedExpiry) {
        return toast.error("Este produto não possui regra de validade após manipulação cadastrada.");
      }
    } else {
      if (!directName.trim()) return toast.error("Informe o nome do produto");
      if (!directOriginBatch.trim()) return toast.error("Informe o lote original");
      if (!directOriginExpiry) return toast.error("Informe a validade original");
    }
    const expiry = mode === "linked"
      ? computedExpiry!
      : new Date(manufacture.getTime() + 24 * 3600_000); // fallback 24h para manipulação direta
    if (expiry <= manufacture) return toast.error("Validade calculada inválida");

    // Novo lote interno MAN-YYYYMMDD-NNN
    let batch = `MAN-${Date.now().toString(36).toUpperCase()}`;
    try {
      const { data: gen } = await (supabase as any).rpc("label_generate_manipulation_lot");
      if (typeof gen === "string" && gen) batch = gen;
    } catch { /* fallback local */ }

    const employee = activeEmployees.find((e) => e.id === employeeId);
    const originLabel = mode === "linked"
      ? (selectedLot!.supplier_lot || selectedLot!.traceability_lot || selectedLot!.batch || "—")
      : directOriginBatch.trim();
    const originSupplier = mode === "linked" ? (selectedLot!.supplier_name || null) : null;
    const originExpiry = mode === "linked"
      ? (selectedLot!.expiry_date ? new Date(selectedLot!.expiry_date) : null)
      : new Date(`${directOriginExpiry}T23:59:00`);
    const finalProductName = mode === "linked" ? selectedProductName : directName.trim();
    const originNote = notes.trim() ? notes.trim() : null;
    const originTag = mode === "direct" ? "Manipulação Direta" : "Recebimento";

    setSaving(true);
    try {
      const inserted: any = await createLabel({
        label_product_id: mode === "linked" ? selectedProductId : null,
        product_name: finalProductName,
        manufacture_date: manufacture,
        expiry_date: expiry,
        quantity: 1,
        batch,
        responsible: employee?.name || null,
        employee_id: employee?.id || null,
        conservation_method: (conservationMethod as any) || "refrigerated",
        notes: originNote ? `[${originTag}] ${originNote}` : `[${originTag}]`,
        origin_issuance_id: mode === "linked" ? selectedLot!.issuance_id : null,
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
          : (directWeight.trim() || null);
        const consMap: Record<string, string> = {
          refrigerated: "REFRIGERADO", frozen: "CONGELADO", ambient: "AMBIENTE", hot: "QUENTE",
        };
        printLabels({
          productName: finalProductName,
          manufactureDate: manufacture,
          expiryDate: expiry,
          originalExpiryDate: originExpiry,
          responsible: employee?.name || full.responsible || "—",
          quantity: 1,
          batch,
          template: "manipulation",
          brand: originSupplier,
          sif: full.sif ?? null,
          notes: originNote ? `Origem: ${originSupplier || "—"} · Lote ${originLabel} · ${originNote}`
                            : `Origem: ${originSupplier || "—"} · Lote ${originLabel}`,
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
      onOpenChange(false);
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
            Escolha a origem. Uma nova etiqueta será gerada com lote interno
            <span className="font-mono"> MAN-…</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seletor de modo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("linked")}
              className={`p-3 rounded-lg border text-left text-xs ${mode === "linked" ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}
            >
              <div className="font-semibold text-sm mb-0.5">Produto recebido</div>
              <div className="text-muted-foreground">Rastreabilidade total (recomendado)</div>
            </button>
            <button
              type="button"
              onClick={() => setMode("direct")}
              className={`p-3 rounded-lg border text-left text-xs ${mode === "direct" ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}
            >
              <div className="font-semibold text-sm mb-0.5">Manipulação direta</div>
              <div className="text-muted-foreground">Sem recebimento prévio</div>
            </button>
          </div>

          {mode === "linked" ? (
            <>
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={selectedProductId} onValueChange={(v) => {
              setSelectedProductId(v);
              const p = productsForSelect.find((x: any) => x.product_id === v);
              setSelectedProductName(p?.product_name ?? "");
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar produto…" /></SelectTrigger>
              <SelectContent>
                {productsForSelect.map((p: any) => (
                  <SelectItem key={p.product_id} value={p.product_id}>{p.product_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Lote de origem</Label>
            {loadingLots ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando lotes ativos…
              </div>
            ) : lots.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-3">
                Nenhum lote ativo. Use <b>Manipulação direta</b> ou registre um recebimento antes.
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
            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-dashed p-3">
              <div className="space-y-1.5">
                <Label>Nome do produto</Label>
                <Input value={directName} onChange={(e) => setDirectName(e.target.value)} placeholder="Ex.: Alface americana" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Peso (opcional)</Label>
                  <Input value={directWeight} onChange={(e) => setDirectWeight(e.target.value)} placeholder="500 g / 1 kg" />
                </div>
                <div className="space-y-1.5">
                  <Label>Lote original</Label>
                  <Input value={directOriginBatch} onChange={(e) => setDirectOriginBatch(e.target.value)} placeholder="Ex.: L2026-07" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Validade original</Label>
                <Input type="date" value={directOriginExpiry} onChange={(e) => setDirectOriginExpiry(e.target.value)} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Origem registrada como <b>Manipulação Direta</b> (sem recebimento anterior).
              </p>
            </div>
          )}

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

          {mode === "linked" && manipulationRule && computedExpiry && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <Clock className="h-3.5 w-3.5" /> Regra aplicada
              </div>
              <div>✓ {manipulationRule.value} {manipulationRule.unit === "hours" ? "hora(s)" : "dia(s)"} após manipulação</div>
              <div className="text-muted-foreground">
                Nova validade calculada: <span className="font-semibold text-foreground">{fmtDateTime(computedExpiry)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-emerald-500/20 mt-1">
                Regra definida pelo estabelecimento no cadastro do produto. O MesaClik apenas aplica automaticamente.
              </p>
            </div>
          )}
          {missingConfig && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Produto sem regra de validade cadastrada
              </div>
              <p className="text-muted-foreground">
                Este produto não possui uma regra de validade após manipulação cadastrada. Defina no cadastro do produto conforme seus POPs.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: porcionado, higienizado…" />
          </div>
          {mode === "linked" && selectedLot && (
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
              (mode === "linked"
                ? (!selectedLot || !manipulationRule)
                : (!directName.trim() || !directOriginBatch.trim() || !directOriginExpiry))
            }
            className="gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar manipulação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
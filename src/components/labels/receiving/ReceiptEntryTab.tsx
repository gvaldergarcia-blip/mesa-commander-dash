import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Truck, FileUp, Loader2, Plus, Trash2, Thermometer, Printer, Save, PackageCheck, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { useLabelProducts, LabelProduct } from "@/hooks/useLabelProducts";
import type { ReceiptPrintContext, ReceiptPrintItem } from "@/lib/labels/receiptContext";
import { formatQty } from "@/lib/labels/stockUnits";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { BulkRegisterDrawer } from "./BulkRegisterDrawer";
import { normAlias } from "@/lib/labels/productInput";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

/** Marca rascunhos salvos por esta sessão: ao voltar para a aba, restaura direto sem aviso. */
let sessionOwnsDraft = false;

interface Row {
  key: string;
  name: string;
  productId: string | null;
  quantity: string;
  unit: string;
  weight: string;
  weightUnit: string;
  batch: string;
  originalExpiry: string;
}

const newRow = (): Row => ({
  key: Math.random().toString(36).slice(2),
  name: "",
  productId: null,
  quantity: "1",
  unit: "un",
  weight: "",
  weightUnit: "kg",
  batch: "",
  originalExpiry: "",
});

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Casa o nome da NF com um produto do cadastro mestre (por tokens em comum). */
function matchProduct(rawName: string, products: LabelProduct[]): LabelProduct | null {
  const tokens = norm(rawName).split(" ").filter((t) => t.length > 2);
  if (!tokens.length) return null;
  let best: { p: LabelProduct; score: number } | null = null;
  for (const p of products) {
    const pn = norm(p.name);
    const score = tokens.reduce((acc, t) => acc + (pn.includes(t) ? 1 : 0), 0) / tokens.length;
    if (score >= 0.6 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

/** Converte texto do operador (vírgula decimal) em número, ou null. */
const num = (v: string): number | null => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * RECEBIMENTO — ponto de entrada do estoque.
 * NF → itens → temperatura (opcional) → [Só computar] ou [Imprimir e computar].
 * Não realiza baixa, consumo ou perda: isso acontece depois, via QR Code da etiqueta.
 */
export function ReceiptEntryTab({
  onPrintReceipt,
  onManageProducts,
}: {
  onPrintReceipt: (ctx: ReceiptPrintContext) => void;
  onManageProducts?: () => void;
}) {
  const restaurantId = useRestaurantId();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const { products } = useLabelProducts();
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  /** Trava contra clique duplo: impede duas entradas no estoque para a mesma nota. */
  const lockRef = useRef(false);

  const [reference, setReference] = useState("");
  const [supplier, setSupplier] = useState("");
  const [temperature, setTemperature] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState<"none" | "compute" | "print">("none");
  const [source, setSource] = useState<"manual" | "xml">("manual");
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const selectedRowIndex = Math.max(0, rows.findIndex((row) => row.key === selectedRowKey));
  const selectedRow = rows[selectedRowIndex];
  const productStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile || !selectedRow) return;
    const strip = productStripRef.current;
    const item = strip?.querySelector<HTMLElement>(`[data-row-key="${selectedRow.key}"]`);
    if (!strip || !item) return;
    strip.scrollTo({ left: item.offsetLeft - strip.offsetLeft - (strip.clientWidth - item.clientWidth) / 2, behavior: "instant" });
  }, [isMobile, selectedRow?.key, mobileStep]);

  const activeProducts = useMemo(
    () => products.filter((p) => (p.status ?? "active") === "active" && (p.origin ?? "received") !== "produced"),
    [products],
  );

  const validRows = rows.filter((r) => r.name.trim().length > 1);
  /** Produtos da nota que ainda não existem no cadastro — bloqueiam o computar. */
  const unregistered = validRows.filter((r) => !r.productId);

  /** Vínculo aprendido (nome da nota → produto) tem prioridade sobre a busca por nome. */
  const resolveProduct = useCallback(
    (raw: string): string | null => aliases[normAlias(raw)] ?? matchProduct(raw, activeProducts)?.id ?? null,
    [aliases, activeProducts],
  );

  useEffect(() => {
    if (!restaurantId) return;
    void (supabase as any).from("label_product_aliases").select("alias_normalized, product_id")
      .eq("restaurant_id", restaurantId).then(({ data }: any) => {
        const m: Record<string, string> = {};
        for (const a of data || []) m[a.alias_normalized] = a.product_id;
        setAliases(m);
      });
  }, [restaurantId]);

  // ===== Rascunho persistente (label_receipt_drafts, kind = "entry") =====
  const [draftReady, setDraftReady] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<any | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [bulkOpen, setBulkOpen] = useState(false);
  const startedAtRef = useRef<string | null>(null);

  const applyDraft = (row: any) => {
    const pl = row.payload || {};
    setReference(row.reference ?? "");
    setSupplier(pl.supplier ?? "");
    setTemperature(pl.temperature ?? "");
    setSource(pl.source === "xml" ? "xml" : "manual");
    setRows(Array.isArray(pl.rows) && pl.rows.length ? pl.rows : [newRow()]);
    startedAtRef.current = pl.started_at ?? row.created_at;
  };

  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;
    setDraftReady(false);
    void (supabase as any).from("label_receipt_drafts").select("*")
      .eq("restaurant_id", restaurantId).eq("kind", "entry").maybeSingle()
      .then(({ data }: any) => {
        if (!alive) return;
        const has = data && Array.isArray(data.payload?.rows) && data.payload.rows.some((x: Row) => x.name?.trim());
        if (has && sessionOwnsDraft) { applyDraft(data); setDraftReady(true); }
        else if (has) setPendingDraft(data);
        else setDraftReady(true);
      });
    return () => { alive = false; };
  }, [restaurantId]);

  const deleteDraft = useCallback(async () => {
    if (!restaurantId) return;
    sessionOwnsDraft = false;
    startedAtRef.current = null;
    await (supabase as any).from("label_receipt_drafts").delete().eq("restaurant_id", restaurantId).eq("kind", "entry");
  }, [restaurantId]);

  useEffect(() => {
    if (!draftReady || !restaurantId) return;
    const hasWork = rows.some((x) => x.name.trim()) ;
    const t = setTimeout(async () => {
      if (!hasWork) { if (sessionOwnsDraft) await deleteDraft(); setSaveState("idle"); return; }
      setSaveState("saving");
      if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("label_receipt_drafts").upsert({
        restaurant_id: restaurantId, kind: "entry", reference: reference || null, updated_by: u?.user?.id ?? null,
        updated_at: new Date().toISOString(),
        payload: { rows, supplier, temperature, source, started_at: startedAtRef.current },
      }, { onConflict: "restaurant_id,kind" });
      sessionOwnsDraft = !error;
      setSaveState(error ? "idle" : "saved");
    }, 800);
    return () => clearTimeout(t);
  }, [rows, reference, supplier, temperature, source, draftReady, restaurantId, deleteDraft]);

  const saveBulk = async (entries: Array<{ key: string; name: string; linkTo: string | null; input?: any }>) => {
    const errs: Record<string, string> = {};
    const links: Record<string, string> = {};
    for (const e of entries) {
      try {
        let pid = e.linkTo;
        if (!pid) {
          const { data, error } = await (supabase as any).from("label_products")
            .insert({ restaurant_id: restaurantId, ...e.input }).select("id").single();
          if (error) throw error;
          pid = data.id;
        }
        links[e.key] = pid!;
        await (supabase as any).rpc("label_learn_alias", { _restaurant_id: restaurantId, _raw: e.name, _product_id: pid });
      } catch (err: any) {
        errs[e.key] = err?.message || "Erro ao salvar";
      }
    }
    const linked = Object.keys(links).length;
    if (linked) {
      setRows((prev) => prev.map((r) => (links[r.key] ? { ...r, productId: links[r.key] } : r)));
      setAliases((a) => {
        const n = { ...a };
        for (const e of entries) if (links[e.key]) n[normAlias(e.name)] = links[e.key];
        return n;
      });
      await qc.invalidateQueries({ queryKey: ["label_products", restaurantId] });
      toast.success(`${linked} produto(s) cadastrado(s) e vinculado(s)`);
    }
    if (Object.keys(errs).length) toast.error(`${Object.keys(errs).length} item(ns) com erro — corrija e salve de novo`);
    return errs;
  };

  const patch = (key: string, data: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...data } : r)));

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const b64: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("parse-receipt-file", {
        body: { file_base64: b64, mime_type: file.type || "application/octet-stream", filename: file.name },
      });
      if (error) throw error;
      const items: any[] = data?.items || [];
      if (!items.length) throw new Error("Nenhum item identificado na nota");
      if (data?.supplier && !supplier) setSupplier(String(data.supplier));
      if (data?.reference && !reference) setReference(String(data.reference));
      setSource("xml");
      setRows(
        items.map((i) => {
          const matchId = resolveProduct(String(i.raw_name || ""));
          return {
            key: Math.random().toString(36).slice(2),
            name: String(i.raw_name || "").trim(),
            productId: matchId,
            quantity: String(i.quantity ?? 1),
            unit: String(i.unit || "un"),
            // Peso vem da NF quando existir — e continua editável pelo operador.
            weight: i.weight != null && Number(i.weight) > 0 ? String(i.weight) : "",
            weightUnit: String(i.weight_unit || "kg"),
            batch: "",
            originalExpiry: "",
          };
        }),
      );
      toast.success(`${items.length} produto(s) lidos da nota fiscal`);
      const missing = items.filter((i) => !resolveProduct(String(i.raw_name || "")));
      if (missing.length) {
        toast.warning(
          `${missing.length} produto(s) da nota não estão cadastrados. Cadastre antes de computar.`,
        );
      }
    } catch (e: any) {
      toast.error(e.message || "Não foi possível ler a nota fiscal");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** Computa: registra a ENTRADA no estoque digital. Nunca dá baixa. */
  const compute = async (mode: "compute" | "print"): Promise<ReceiptPrintContext | null> => {
    if (!restaurantId) {
      toast.error("Restaurante não identificado");
      return null;
    }
    if (!validRows.length) {
      toast.error("Adicione pelo menos um produto");
      return null;
    }
    const badQty = validRows.filter((r) => num(r.quantity) == null);
    if (badQty.length) {
      toast.error(`Corrija a quantidade de: ${badQty.map((r) => r.name.trim()).join(", ")}`);
      return null;
    }
    if (mode === "print" && unregistered.length) {
      toast.error(
        `Cadastre primeiro: ${unregistered.map((r) => r.name.trim()).join(", ")}`,
      );
      return null;
    }
    if (mode === "compute" && !validRows.some((r) => r.productId)) {
      toast.error("Nenhum produto da nota está cadastrado. Cadastre pelo menos um para computar.");
      return null;
    }
    const temp = temperature.trim() ? Number(temperature.replace(",", ".")) : null;
    const { data: receipt, error: rErr } = await (supabase as any)
      .from("label_receipts")
      .insert({
        restaurant_id: restaurantId,
        source,
        status: "confirmed",
        reference: reference.trim() || null,
        notes: supplier.trim() ? `Fornecedor: ${supplier.trim()}` : null,
        temperature_c: temp !== null && !Number.isNaN(temp) ? temp : null,
        computed_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (rErr) throw rErr;

    const payload = validRows.map((r) => ({
      restaurant_id: restaurantId,
      receipt_id: receipt.id,
      raw_name: r.name.trim(),
      product_id: r.productId,
      quantity: Number(r.quantity.replace(",", ".")) || 1,
      unit: r.unit || "un",
      weight: num(r.weight),
      weight_unit: num(r.weight) != null ? r.weightUnit || "kg" : null,
      supplier_lot: r.batch.trim() || null,
      original_expiry_date: r.originalExpiry || null,
      // Produto sem cadastro fica registrado na nota (rastreável), mas não entra no saldo.
      needs_info: !r.productId,
      missing_fields: r.productId ? [] : ["product_id"],
      labels_prepared: 0,
    }));
    const { error: iErr } = await (supabase as any).from("label_receipt_items").insert(payload);
    if (iErr) throw iErr;

    // Registro da ENTRADA no estoque digital (sem qualquer baixa).
    const { error: mErr } = await (supabase as any).from("label_stock_movements").insert(
      validRows.filter((r) => r.productId).map((r) => ({
        restaurant_id: restaurantId,
        event_type: "receipt",
        product_id: r.productId,
        receipt_id: receipt.id,
        quantity: Number(r.quantity.replace(",", ".")) || 1,
        unit: r.unit || "un",
        occurred_at: new Date().toISOString(),
        notes: [
          reference.trim() ? `NF ${reference.trim()}` : null,
          r.batch.trim() ? `Lote ${r.batch.trim()}` : null,
          num(r.weight) ? `Peso ${num(r.weight)} ${r.weightUnit || "kg"}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      })),
    );
    if (mErr) throw mErr;

    qc.invalidateQueries({ queryKey: ["label_receipts", restaurantId] });

    const items: ReceiptPrintItem[] = validRows.map((r) => ({
      key: r.key,
      productId: r.productId,
      productName: r.name.trim(),
      quantity: Number(r.quantity.replace(",", ".")) || 1,
      unit: r.unit || "un",
      weight: num(r.weight),
      weightUnit: num(r.weight) ? r.weightUnit || "kg" : null,
      batch: r.batch.trim() || null,
      originalExpiry: r.originalExpiry || null,
    }));
    return { receiptId: receipt.id, reference: reference.trim() || null, supplierName: supplier.trim() || null, items };
  };

  const reset = () => {
    void deleteDraft();
    setReference("");
    setSupplier("");
    setTemperature("");
    setRows([newRow()]);
    setSource("manual");
  };

  const onlyCompute = async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setSaving("compute");
    try {
      const skipped = unregistered.length;
      const ctx = await compute("compute");
      if (ctx) {
        toast.success(`Entrada registrada no estoque: ${ctx.items.length - skipped} produto(s)`);
        if (skipped) toast.warning(`${skipped} produto(s) sem cadastro ficaram fora do estoque.`);
        reset();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao computar recebimento");
    } finally {
      lockRef.current = false;
      setSaving("none");
    }
  };

  const computeAndPrint = async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setSaving("print");
    try {
      const ctx = await compute("print");
      if (ctx) {
        toast.success("Entrada registrada. Selecione as etiquetas para imprimir.");
        reset();
        onPrintReceipt(ctx);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao computar recebimento");
    } finally {
      lockRef.current = false;
      setSaving("none");
    }
  };

  const busy = saving !== "none";

  return (
    <div className="space-y-3 max-md:pb-40 md:space-y-4">
      {pendingDraft && (
        <Card className="flex flex-col gap-3 border-primary/40 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            Você tem um recebimento em andamento ({(pendingDraft.payload?.rows || []).filter((x: Row) => x.name?.trim()).length} itens, iniciado às{" "}
            {new Date(pendingDraft.payload?.started_at || pendingDraft.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmDiscard(true)}>Descartar</Button>
            <Button onClick={() => { applyDraft(pendingDraft); sessionOwnsDraft = true; setPendingDraft(null); setDraftReady(true); }}>Continuar</Button>
          </div>
        </Card>
      )}
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar recebimento em andamento?</AlertDialogTitle>
            <AlertDialogDescription>Os produtos já lidos serão apagados. Isso não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await deleteDraft(); setPendingDraft(null); setDraftReady(true); }}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BulkRegisterDrawer
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        items={unregistered.map((r) => ({ key: r.key, name: r.name.trim(), unit: r.unit }))}
        supplier={supplier}
        products={activeProducts}
        onSave={saveBulk}
      />
      <div className="md:hidden" aria-label={`Etapa ${mobileStep} de 3`}>
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>Etapa {mobileStep} de 3</span>
          <span>{mobileStep === 1 ? "Referência" : mobileStep === 2 ? "Produtos" : "Conferir"}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((step) => <span key={step} className={cn("h-1.5 rounded-full bg-muted", mobileStep >= step && "bg-primary")} />)}
        </div>
      </div>
      <div className="hidden md:block">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" /> Recebimento
        </h2>
        <p className="text-sm text-muted-foreground">
          Nota fiscal → produtos → temperatura (opcional) → computar a entrada. A baixa acontece depois, pelo QR Code da etiqueta.
        </p>
      </div>

      {/* NF */}
      <Card className={cn("p-4 space-y-4 bg-card/40 max-md:p-3 max-md:space-y-3", mobileStep !== 1 && "max-md:hidden")}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 [&>div]:min-w-0">
          <div className="space-y-1">
            <Label htmlFor="rc-ref">Nota fiscal / referência</Label>
            <Input id="rc-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="NF 000.123.456" className="h-11" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rc-sup">Fornecedor</Label>
            <Input id="rc-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nome do fornecedor" className="h-11" />
          </div>
          <div className="space-y-1 max-md:col-span-2">
            <Label htmlFor="rc-temp" className="flex items-center gap-1.5">
              <Thermometer className="h-3.5 w-3.5" /> Temperatura (°C) — opcional
            </Label>
            <Input
              id="rc-temp"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="Ex.: -2"
              inputMode="decimal"
              className="h-11"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xml,.pdf,.csv,.xlsx,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing || busy} className="gap-2">
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Importar nota fiscal
          </Button>
          <Button variant="ghost" onClick={() => setRows((p) => [...p, newRow()])} disabled={busy} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar produto
          </Button>
        </div>
      </Card>

      {/* Itens */}
      <Card className={cn("p-3 md:p-4 space-y-2 bg-card/40", mobileStep !== 2 && "max-md:hidden")}>
        {unregistered.length > 0 && (
          <Button variant="destructive" className="h-11 w-full gap-2" onClick={() => setBulkOpen(true)}>
            <Plus className="h-4 w-4" /> Cadastrar {unregistered.length} produto{unregistered.length === 1 ? "" : "s"}
          </Button>
        )}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Produtos recebidos</h3>
          <div className="flex items-center gap-2">
            {saveState !== "idle" && (
              <span className="text-[11px] text-muted-foreground" aria-live="polite">{saveState === "saving" ? "Salvando…" : "Salvo"}</span>
            )}
            <Badge variant="outline" className="text-[10px]">{validRows.length} item(ns)</Badge>
          </div>
        </div>

        {/* Resumo quantitativo da NF — o que efetivamente entrou no estoque. */}
        {validRows.length > 0 && (
          <div className="hidden md:flex flex-wrap gap-1.5 pb-1">
            {validRows.map((r) => (
              <span
                key={`sum-${r.key}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/[0.07] px-2.5 py-1 text-[11px]"
              >
                <span className="truncate max-w-[160px]">{r.name.trim()}</span>
                <strong className="text-primary">{formatQty(Number(r.quantity.replace(",", ".")) || 0, r.unit)}</strong>
                {num(r.weight) && <span className="text-muted-foreground">· {num(r.weight)} {r.weightUnit}</span>}
              </span>
            ))}
          </div>
        )}
        <div ref={productStripRef} className="scrollbar-none relative flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain py-1 md:hidden" aria-label="Produtos da nota">
          {rows.map((r, index) => (
            <Button
              key={r.key}
              data-row-key={r.key}
              variant="outline"
              aria-pressed={selectedRow?.key === r.key}
              onClick={() => setSelectedRowKey(r.key)}
              className={cn("h-12 max-w-[220px] shrink-0 justify-start gap-2 px-3", selectedRow?.key === r.key && "border-primary bg-primary/10 text-primary")}
            >
              <span className="text-xs text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm">{r.name.trim() || "Novo produto"}</span>
                <span className="block text-xs text-muted-foreground">{formatQty(Number(r.quantity.replace(",", ".")) || 0, r.unit)}</span>
              </span>
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 md:hidden">
          <span className="text-xs font-medium text-muted-foreground">Produto {selectedRowIndex + 1} de {rows.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Produto anterior" disabled={selectedRowIndex === 0} onClick={() => setSelectedRowKey(rows[selectedRowIndex - 1]?.key ?? null)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Próximo produto" disabled={selectedRowIndex >= rows.length - 1} onClick={() => setSelectedRowKey(rows[selectedRowIndex + 1]?.key ?? null)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-10 w-10" aria-label="Adicionar produto" disabled={busy} onClick={() => { const row = newRow(); setRows((prev) => [...prev, row]); setSelectedRowKey(row.key); }}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-2">
          {(isMobile ? rows.filter((r) => r.key === selectedRow?.key) : rows).map((r) => {
            const matched = r.productId ? activeProducts.find((p) => p.id === r.productId) : null;
            return (
              <div key={r.key} className="grid grid-cols-2 md:grid-cols-[1fr_90px_80px_110px_80px_130px_150px_40px] gap-2 items-end rounded-xl border border-border/60 p-3 max-md:rounded-none max-md:border-0 max-md:p-0 [&>div]:min-w-0 [&_label]:max-md:text-xs [&_input]:max-md:h-11 [&_input]:min-w-0 [&_input]:max-w-full">
                <div className="space-y-1 max-md:col-span-2">
                  <Label htmlFor={`rc-name-${r.key}`} className="text-[11px]">Produto</Label>
                  <Input
                    id={`rc-name-${r.key}`}
                    value={r.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      patch(r.key, { name, productId: resolveProduct(name) });
                    }}
                    placeholder="Nome do produto"
                    className="h-10"
                  />
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground truncate">
                    <strong className="text-xs text-foreground">
                      {formatQty(Number(r.quantity.replace(",", ".")) || 0, r.unit)}
                    </strong>
                    {matched ? <span className="truncate">Cadastro: {matched.name}</span>
                      : r.name.trim() ? <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Não cadastrado</Badge>
                      : <span className="truncate">Sem vínculo com o cadastro</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rc-qty-${r.key}`} className="text-[11px]">Qtd</Label>
                  <Input id={`rc-qty-${r.key}`} value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} inputMode="decimal" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rc-unit-${r.key}`} className="text-[11px]">Un.</Label>
                  <Input id={`rc-unit-${r.key}`} value={r.unit} onChange={(e) => patch(r.key, { unit: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rc-weight-${r.key}`} className="text-[11px]">Peso</Label>
                  <Input
                    id={`rc-weight-${r.key}`}
                    value={r.weight}
                    onChange={(e) => patch(r.key, { weight: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,000"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rc-weight-unit-${r.key}`} className="text-[11px]">Un. peso</Label>
                  <Input id={`rc-weight-unit-${r.key}`} value={r.weightUnit} onChange={(e) => patch(r.key, { weightUnit: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rc-batch-${r.key}`} className="text-[11px]">Lote</Label>
                  <Input id={`rc-batch-${r.key}`} value={r.batch} onChange={(e) => patch(r.key, { batch: e.target.value })} placeholder="Lote do fabricante" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`rc-expiry-${r.key}`} className="text-[11px]">Validade original</Label>
                  <Input id={`rc-expiry-${r.key}`} type="date" value={r.originalExpiry} onChange={(e) => patch(r.key, { originalExpiry: e.target.value })} className="h-10 max-md:px-1" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive max-md:ml-auto max-md:col-span-2"
                  aria-label="Remover produto"
                  onClick={() => setRows((prev) => (prev.length === 1 ? [newRow()] : prev.filter((x) => x.key !== r.key)))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {isMobile && mobileStep === 3 && (
        <Card className="space-y-3 p-4">
          <h3 className="font-bold">Conferir recebimento</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Referência</span><p className="font-semibold">{reference || "Não informada"}</p></div>
            <div><span className="text-muted-foreground">Fornecedor</span><p className="font-semibold">{supplier || "Não informado"}</p></div>
            <div><span className="text-muted-foreground">Produtos</span><p className="font-semibold">{validRows.length}</p></div>
            <div><span className="text-muted-foreground">Temperatura</span><p className="font-semibold">{temperature ? `${temperature} °C` : "Não informada"}</p></div>
          </div>
        </Card>
      )}

      {isMobile && mobileStep < 3 && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 flex gap-2 border-t border-border bg-background p-2.5">
          {mobileStep > 1 && <Button variant="outline" className="h-12 flex-1" onClick={() => setMobileStep(1)}>Voltar</Button>}
          <Button className="h-12 flex-1" onClick={() => setMobileStep(mobileStep === 1 ? 2 : 3)}>
            {mobileStep === 1 ? "Adicionar produtos" : "Conferir entrada"}
          </Button>
        </div>
      )}

       {/* Ações */}
      <Card className={cn("p-4 flex flex-col sm:flex-row gap-3 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20", mobileStep !== 3 && "max-md:hidden", "max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-md:z-50 max-md:flex-row max-md:rounded-none max-md:border-x-0 max-md:border-b-0 max-md:p-2.5")}>
        <Button variant="outline" size="lg" className="h-14 flex-1 gap-1 px-2 text-xs font-bold sm:gap-2 sm:text-sm" onClick={onlyCompute} disabled={busy || !validRows.some((r) => r.productId)} title="Registra a entrada no estoque sem imprimir. Lote e validade não são obrigatórios.">
          {saving === "compute" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          SÓ COMPUTAR
        </Button>
        <Button size="lg" className="h-14 flex-1 gap-1 px-2 text-xs font-bold sm:gap-2 sm:text-sm" onClick={computeAndPrint} disabled={busy || !validRows.length || unregistered.length > 0}>
          {saving === "print" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
          IMPRIMIR E COMPUTAR
        </Button>
      </Card>

      <p className="hidden text-[11px] text-muted-foreground items-center gap-1.5 md:flex">
        <PackageCheck className="h-3.5 w-3.5" />
        <strong>Só computar</strong> registra a entrada no estoque sem exigir lote ou validade. Etiquetas impressas aqui são de <strong>produto lacrado</strong> (validade original do fabricante).
      </p>
    </div>
  );
}

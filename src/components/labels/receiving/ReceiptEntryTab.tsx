import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Truck, FileUp, Loader2, Plus, Trash2, Thermometer, Printer, Save, PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/contexts/RestaurantContext";
import { useLabelProducts, LabelProduct } from "@/hooks/useLabelProducts";
import type { ReceiptPrintContext, ReceiptPrintItem } from "@/lib/labels/receiptContext";
import { formatQty } from "@/lib/labels/stockUnits";

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
  const qc = useQueryClient();
  const { products } = useLabelProducts();
  const fileRef = useRef<HTMLInputElement>(null);

  const [reference, setReference] = useState("");
  const [supplier, setSupplier] = useState("");
  const [temperature, setTemperature] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState<"none" | "compute" | "print">("none");
  const [source, setSource] = useState<"manual" | "xml">("manual");

  const activeProducts = useMemo(
    () => products.filter((p) => (p.status ?? "active") === "active" && (p.origin ?? "received") !== "produced"),
    [products],
  );

  const validRows = rows.filter((r) => r.name.trim().length > 1);
  /** Produtos da nota que ainda não existem no cadastro — bloqueiam o computar. */
  const unregistered = validRows.filter((r) => !r.productId);

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
          const match = matchProduct(String(i.raw_name || ""), activeProducts);
          return {
            key: Math.random().toString(36).slice(2),
            name: String(i.raw_name || "").trim(),
            productId: match?.id ?? null,
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
      const missing = items.filter((i) => !matchProduct(String(i.raw_name || ""), activeProducts));
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
  const compute = async (): Promise<ReceiptPrintContext | null> => {
    if (!restaurantId) {
      toast.error("Restaurante não identificado");
      return null;
    }
    if (!validRows.length) {
      toast.error("Adicione pelo menos um produto");
      return null;
    }
    if (unregistered.length) {
      toast.error(
        `Cadastre primeiro: ${unregistered.map((r) => r.name.trim()).join(", ")}`,
      );
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
      needs_info: false,
      missing_fields: [],
      labels_prepared: 0,
    }));
    const { error: iErr } = await (supabase as any).from("label_receipt_items").insert(payload);
    if (iErr) throw iErr;

    // Registro da ENTRADA no estoque digital (sem qualquer baixa).
    const { error: mErr } = await (supabase as any).from("label_stock_movements").insert(
      validRows.map((r) => ({
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
    setReference("");
    setSupplier("");
    setTemperature("");
    setRows([newRow()]);
    setSource("manual");
  };

  const onlyCompute = async () => {
    setSaving("compute");
    try {
      const ctx = await compute();
      if (ctx) {
        toast.success(`Entrada registrada: ${ctx.items.length} produto(s)`);
        reset();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao computar recebimento");
    } finally {
      setSaving("none");
    }
  };

  const computeAndPrint = async () => {
    setSaving("print");
    try {
      const ctx = await compute();
      if (ctx) {
        toast.success("Entrada registrada. Selecione as etiquetas para imprimir.");
        reset();
        onPrintReceipt(ctx);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao computar recebimento");
    } finally {
      setSaving("none");
    }
  };

  const busy = saving !== "none";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" /> Recebimento
        </h2>
        <p className="text-sm text-muted-foreground">
          Nota fiscal → produtos → temperatura (opcional) → computar a entrada. A baixa acontece depois, pelo QR Code da etiqueta.
        </p>
      </div>

      {/* NF */}
      <Card className="p-4 space-y-4 bg-card/40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="rc-ref">Nota fiscal / referência</Label>
            <Input id="rc-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="NF 000.123.456" className="h-11" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rc-sup">Fornecedor</Label>
            <Input id="rc-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nome do fornecedor" className="h-11" />
          </div>
          <div className="space-y-1">
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
      <Card className="p-3 md:p-4 space-y-2 bg-card/40">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Produtos recebidos</h3>
          <Badge variant="outline" className="text-[10px]">{validRows.length} item(ns)</Badge>
        </div>

        {/* Resumo quantitativo da NF — o que efetivamente entrou no estoque. */}
        {validRows.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
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
        <div className="space-y-2">
          {rows.map((r) => {
            const matched = r.productId ? activeProducts.find((p) => p.id === r.productId) : null;
            return (
              <div key={r.key} className="grid grid-cols-1 md:grid-cols-[1fr_90px_80px_110px_80px_130px_150px_40px] gap-2 items-end rounded-xl border border-border/60 p-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Produto</Label>
                  <Input
                    value={r.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const m = matchProduct(name, activeProducts);
                      patch(r.key, { name, productId: m?.id ?? null });
                    }}
                    placeholder="Nome do produto"
                    className="h-10"
                  />
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground truncate">
                    <strong className="text-xs text-foreground">
                      {formatQty(Number(r.quantity.replace(",", ".")) || 0, r.unit)}
                    </strong>
                    <span className="truncate">{matched ? `Cadastro: ${matched.name}` : "Sem vínculo com o cadastro"}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Qtd</Label>
                  <Input value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} inputMode="decimal" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Un.</Label>
                  <Input value={r.unit} onChange={(e) => patch(r.key, { unit: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Peso</Label>
                  <Input
                    value={r.weight}
                    onChange={(e) => patch(r.key, { weight: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,000"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Un. peso</Label>
                  <Input value={r.weightUnit} onChange={(e) => patch(r.key, { weightUnit: e.target.value })} className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Lote</Label>
                  <Input value={r.batch} onChange={(e) => patch(r.key, { batch: e.target.value })} placeholder="Lote do fabricante" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Validade original</Label>
                  <Input type="date" value={r.originalExpiry} onChange={(e) => patch(r.key, { originalExpiry: e.target.value })} className="h-10" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setRows((prev) => (prev.length === 1 ? [newRow()] : prev.filter((x) => x.key !== r.key)))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Ações */}
      <Card className="p-4 flex flex-col sm:flex-row gap-3 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <Button variant="outline" size="lg" className="flex-1 h-14 font-bold gap-2" onClick={onlyCompute} disabled={busy || !validRows.length}>
          {saving === "compute" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          SÓ COMPUTAR
        </Button>
        <Button size="lg" className="flex-1 h-14 font-bold gap-2" onClick={computeAndPrint} disabled={busy || !validRows.length}>
          {saving === "print" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
          IMPRIMIR E COMPUTAR
        </Button>
      </Card>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <PackageCheck className="h-3.5 w-3.5" />
        Computar registra apenas a entrada no estoque. Etiquetas impressas aqui são de <strong>produto lacrado</strong> (validade original do fabricante).
      </p>
    </div>
  );
}

import { useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Camera, Loader2, Sparkles, CheckCircle2, AlertTriangle, PenLine,
  Upload, X, Image as ImageIcon, Clock,
} from "lucide-react";
import { SectorCombobox } from "@/components/labels/SectorCombobox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useReceipts } from "@/hooks/useReceipts";
import { cn } from "@/lib/utils";

const MAX_PHOTOS_PER_PRODUCT = 10;

type Conservation = "refrigerated" | "frozen" | "ambient" | "hot";
type RowStatus = "idle" | "scanning" | "needs_info" | "ready";

interface RowPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

interface PendingRow {
  itemId: string;
  rawName: string;
  name: string;
  validity_date: string; // YYYY-MM-DD
  conservation: Conservation;
  category: string;
  storage_location: string;
  sif: string;
  batch: string;
  brand: string;
  weight: string;
  confidence: number; // 0..1 (0 = ainda não lido)
  processed: boolean;   // IA já rodou (mesmo que sem match) OU marcado manual
  photos: RowPhoto[];
  status: RowStatus;
  missing: string[];    // campos que a IA não conseguiu ler / precisam atenção
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeName(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/** Similaridade simples por sobreposição de tokens significativos (>=3 chars). */
function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a));
  const tb = new Set(normalizeName(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size);
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 1;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 1;
  const target = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getTime();
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(1, Math.round((target - todayUTC) / 86400000));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });
}

// "9,84 kg" | "1kg" | "500 g" | "1L" -> { value, unit }
function parseWeightString(s: string | null | undefined): { value: number; unit: string } | null {
  if (!s) return null;
  const m = String(s).replace(",", ".").toLowerCase().match(/([\d.]+)\s*(kg|g|l|ml)/);
  if (!m) return null;
  const v = Number(m[1]);
  if (!isFinite(v) || v <= 0) return null;
  return { value: v, unit: m[2] };
}

interface Props {
  receiptId: string;
  supplierId?: string | null;
  pendingItems: Array<{ id: string; raw_name: string }>;
  onDone?: () => void;
}

export function PendingItemsPanel({ receiptId, supplierId, pendingItems, onDone }: Props) {
  const { bulkResolvePending, isBulkResolving } = useReceipts();
  const [rows, setRows] = useState<PendingRow[]>(() =>
    pendingItems.map((it) => ({
      itemId: it.id,
      rawName: it.raw_name,
      name: it.raw_name,
      validity_date: todayPlus(3),
      conservation: "refrigerated" as Conservation,
      category: "",
      storage_location: "",
      sif: "",
      batch: "",
      brand: "",
      weight: "",
      confidence: 0,
      processed: false,
      photos: [],
      status: "idle" as RowStatus,
      missing: [],
    })),
  );

  const patch = useCallback((itemId: string, upd: Partial<PendingRow> | ((r: PendingRow) => Partial<PendingRow>)) =>
    setRows((rs) => rs.map((r) => {
      if (r.itemId !== itemId) return r;
      const p = typeof upd === "function" ? upd(r) : upd;
      return { ...r, ...p };
    })),
  []);

  const recomputeStatus = (r: PendingRow): RowStatus => {
    if (r.status === "scanning") return "scanning";
    if (!r.processed) return "idle";
    const missing = computeMissing(r);
    return missing.length === 0 ? "ready" : "needs_info";
  };

  const runAiForRow = useCallback(async (row: PendingRow) => {
    if (!row.photos.length) return;
    patch(row.itemId, { status: "scanning" });
    try {
      const photos = await Promise.all(
        row.photos.slice(0, MAX_PHOTOS_PER_PRODUCT).map(async (p) => ({
          base64: await fileToBase64(p.file),
          mime_type: p.file.type,
        })),
      );
      const { data, error } = await supabase.functions.invoke("parse-labels-batch", {
        body: { photos, candidates: [row.rawName] },
      });
      if (error) throw error;
      const labels = ((data?.results ?? []) as Array<{ labels: any[] }>).flatMap((r) => r.labels || []);
      // Escolhe o melhor label — se houver match usa; senão pega o de maior confiança
      let best: any = null;
      for (const lb of labels) {
        if (!lb) continue;
        if (!best || (lb.confidence ?? 0) > (best.confidence ?? 0)) best = lb;
      }
      setRows((rs) => rs.map((r) => {
        if (r.itemId !== row.itemId) return r;
        const merged: PendingRow = {
          ...r,
          processed: true,
          confidence: best?.confidence ?? 0,
          name: best?.name || r.name,
          validity_date: best?.expires_at || r.validity_date,
          conservation: best?.conservation || r.conservation,
          sif: best?.sif || r.sif,
          batch: best?.batch || r.batch,
          brand: best?.brand || r.brand,
          weight: best?.weight || r.weight,
          status: "scanning",
          missing: [],
        };
        merged.missing = computeMissing(merged);
        merged.status = merged.missing.length === 0 ? "ready" : "needs_info";
        return merged;
      }));
      if (!best) {
        toast.warning(`Nada reconhecido em "${row.rawName}". Preencha manualmente.`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao ler fotos");
      patch(row.itemId, (r) => ({ status: r.processed ? recomputeStatus(r) : "idle" }));
    }
  }, [patch]);

  const addPhotos = useCallback(async (itemId: string, files: FileList | null) => {
    if (!files || !files.length) return;
    let rowSnapshot: PendingRow | null = null;
    setRows((rs) => rs.map((r) => {
      if (r.itemId !== itemId) return r;
      const remaining = Math.max(0, MAX_PHOTOS_PER_PRODUCT - r.photos.length);
      const incoming = Array.from(files).slice(0, remaining).map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
      }));
      if (incoming.length === 0) {
        toast.warning(`Limite de ${MAX_PHOTOS_PER_PRODUCT} fotos por produto atingido.`);
        return r;
      }
      const next = { ...r, photos: [...r.photos, ...incoming] };
      rowSnapshot = next;
      return next;
    }));
    // Dispara IA automaticamente para o produto assim que fotos são anexadas.
    if (rowSnapshot) await runAiForRow(rowSnapshot);
  }, [runAiForRow]);

  const removePhoto = (itemId: string, photoId: string) => {
    setRows((rs) => rs.map((r) => {
      if (r.itemId !== itemId) return r;
      const removed = r.photos.find((p) => p.id === photoId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return { ...r, photos: r.photos.filter((p) => p.id !== photoId) };
    }));
  };

  const markManual = (itemId: string) =>
    setRows((rs) => rs.map((r) => {
      if (r.itemId !== itemId) return r;
      const merged: PendingRow = { ...r, processed: true, confidence: 1 };
      merged.missing = computeMissing(merged);
      merged.status = merged.missing.length === 0 ? "ready" : "needs_info";
      return merged;
    }));

  const readyRows = useMemo(() => rows.filter((r) => r.status === "ready"), [rows]);
  const needsInfoRows = useMemo(() => rows.filter((r) => r.status === "needs_info"), [rows]);
  const idleRows = useMemo(() => rows.filter((r) => r.status === "idle"), [rows]);
  const scanningRows = useMemo(() => rows.filter((r) => r.status === "scanning"), [rows]);

  const handleFinalize = async () => {
    if (readyRows.length === 0) {
      toast.warning("Nenhum produto pronto. Anexe fotos ou preencha os campos faltantes.");
      return;
    }
    await bulkResolvePending({
      receiptId,
      supplierId: supplierId ?? null,
      items: readyRows.map((r) => {
        const w = parseWeightString(r.weight);
        return {
          itemId: r.itemId,
          rawName: r.rawName,
          name: r.name,
          validity_days: daysUntil(r.validity_date),
          conservation_method: r.conservation,
          category: r.category || null,
          storage_location: r.storage_location || null,
          sif: r.sif || null,
          batch: r.batch || null,
          weight: w?.value ?? null,
          weight_unit: w?.unit ?? null,
        };
      }),
    });
    // Remove os que acabaram de ser processados; deixa os pendentes no painel.
    const processedIds = new Set(readyRows.map((r) => r.itemId));
    setRows((rs) => {
      rs.forEach((r) => {
        if (processedIds.has(r.itemId)) r.photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      });
      return rs.filter((r) => !processedIds.has(r.itemId));
    });
    const pendingLeft = rows.length - readyRows.length;
    if (pendingLeft === 0) onDone?.();
    else {
      toast.info(`${readyRows.length} etiqueta(s) gerada(s). ${pendingLeft} produto(s) ficaram pendentes.`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Resumo do recebimento */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Evidências por produto</h3>
          <p className="text-xs text-muted-foreground ml-auto">Anexe até {MAX_PHOTOS_PER_PRODUCT} fotos por item — a IA processa cada produto individualmente.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="produtos" value={rows.length} tone="neutral" />
          <SummaryCard label="prontos" value={readyRows.length} tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <SummaryCard label="aguardando confirmação" value={needsInfoRows.length} tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
          <SummaryCard label="aguardando fotos" value={idleRows.length + scanningRows.length} tone="muted" icon={<Clock className="h-3.5 w-3.5" />} />
        </div>
      </div>

      {/* Cards por produto */}
      <div className="space-y-3">
        {rows.map((r) => (
          <ProductRowCard
            key={r.itemId}
            row={r}
            onAddPhotos={(files) => addPhotos(r.itemId, files)}
            onRemovePhoto={(pid) => removePhoto(r.itemId, pid)}
            onPatch={(upd) => patch(r.itemId, upd)}
            onMarkManual={() => markManual(r.itemId)}
            onReprocess={() => runAiForRow(r)}
          />
        ))}
      </div>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{readyRows.length}</span> pronto(s) para etiqueta ·{" "}
          {needsInfoRows.length > 0 && <><span className="text-amber-600 font-medium">{needsInfoRows.length}</span> aguardando confirmação · </>}
          {(idleRows.length + scanningRows.length) > 0 && <span className="text-muted-foreground">{idleRows.length + scanningRows.length} aguardando fotos</span>}
        </p>
        <Button
          size="lg"
          onClick={handleFinalize}
          disabled={isBulkResolving || readyRows.length === 0}
          className="gap-2"
        >
          {isBulkResolving && <Loader2 className="h-4 w-4 animate-spin" />}
          Finalizar Recebimento {readyRows.length > 0 ? `(${readyRows.length})` : ""}
        </Button>
      </div>
    </div>
  );
}

/* -------------- helpers ---------------- */

function computeMissing(r: PendingRow): string[] {
  const miss: string[] = [];
  if (!r.storage_location.trim()) miss.push("Local");
  if (!r.validity_date) miss.push("Validade");
  if (!r.batch.trim()) miss.push("Lote");
  return miss;
}

/* -------------- subcomponents ---------------- */

function SummaryCard({ label, value, tone, icon }: { label: string; value: number; tone: "neutral" | "success" | "warning" | "muted"; icon?: React.ReactNode }) {
  const toneCls = {
    neutral: "bg-background border-border text-foreground",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
    muted: "bg-muted/40 border-border text-muted-foreground",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2 flex items-center gap-2", toneCls)}>
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-wide truncate">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status, missing, confidence }: { status: RowStatus; missing: string[]; confidence: number }) {
  if (status === "idle") return <Badge variant="outline" className="gap-1 text-[11px]"><Clock className="h-3 w-3" /> Aguardando fotos</Badge>;
  if (status === "scanning") return <Badge className="gap-1 text-[11px] bg-sky-500/15 text-sky-600 border-sky-500/30"><Loader2 className="h-3 w-3 animate-spin" /> Processando IA…</Badge>;
  if (status === "needs_info") return <Badge className="gap-1 text-[11px] bg-amber-500/15 text-amber-700 border-amber-500/30"><AlertTriangle className="h-3 w-3" /> Faltam {missing.length} campo(s)</Badge>;
  return <Badge className="gap-1 text-[11px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30"><CheckCircle2 className="h-3 w-3" /> Pronto {confidence > 0 && confidence < 1 ? `· ${Math.round(confidence * 100)}%` : ""}</Badge>;
}

function ProductRowCard({
  row, onAddPhotos, onRemovePhoto, onPatch, onMarkManual, onReprocess,
}: {
  row: PendingRow;
  onAddPhotos: (files: FileList | null) => void;
  onRemovePhoto: (id: string) => void;
  onPatch: (upd: Partial<PendingRow>) => void;
  onMarkManual: () => void;
  onReprocess: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const canAddMore = row.photos.length < MAX_PHOTOS_PER_PRODUCT;
  const showMissingFields = row.status === "needs_info" || row.status === "ready";

  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all",
      row.status === "ready" && "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]",
      row.status === "needs_info" && "border-amber-500/40",
      row.status === "scanning" && "border-sky-500/40",
    )}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-base leading-tight">{row.name}</h4>
            <StatusBadge status={row.status} missing={row.missing} confidence={row.confidence} />
          </div>
          {(row.rawName !== row.name || row.brand || row.weight || row.sif) && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {row.rawName !== row.name && <span>({row.rawName})</span>}
              {row.brand && <span> · {row.brand}</span>}
              {row.weight && <span> · {row.weight}</span>}
              {row.sif && <span> · SIF {row.sif}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button" size="sm" variant="outline" className="gap-1.5 h-8"
            onClick={() => cameraRef.current?.click()}
            disabled={!canAddMore || row.status === "scanning"}
          >
            <Camera className="h-3.5 w-3.5" /> Câmera
          </Button>
          <Button
            type="button" size="sm" variant="outline" className="gap-1.5 h-8"
            onClick={() => filesRef.current?.click()}
            disabled={!canAddMore || row.status === "scanning"}
          >
            <Upload className="h-3.5 w-3.5" /> Arquivos
          </Button>
          {!row.processed && (
            <Button
              type="button" size="sm" variant="ghost" className="h-8 gap-1 text-[11px]"
              onClick={onMarkManual}
              title="Preencher manualmente"
            >
              <PenLine className="h-3 w-3" /> Manual
            </Button>
          )}
          <input
            ref={cameraRef} type="file" accept="image/*" capture="environment"
            multiple className="hidden"
            onChange={(e) => { onAddPhotos(e.target.files); if (cameraRef.current) cameraRef.current.value = ""; }}
          />
          <input
            ref={filesRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { onAddPhotos(e.target.files); if (filesRef.current) filesRef.current.value = ""; }}
          />
        </div>
      </div>

      {/* Área de fotos */}
      <div
        className={cn(
          "px-4 pb-3",
          dragging && "bg-primary/5",
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          onAddPhotos(e.dataTransfer.files);
        }}
      >
        {row.photos.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
            <ImageIcon className="h-5 w-5 opacity-60" />
            Nenhuma foto anexada — arraste aqui, use a câmera ou envie arquivos (máx. {MAX_PHOTOS_PER_PRODUCT}).
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {row.photos.map((p) => (
              <div key={p.id} className="relative w-16 h-16 rounded-lg overflow-hidden border bg-muted group">
                <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(p.id)}
                  className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remover foto"
                  disabled={row.status === "scanning"}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {row.processed && row.status !== "scanning" && (
              <Button
                type="button" size="sm" variant="ghost"
                className="h-16 gap-1 text-[11px]"
                onClick={onReprocess}
              >
                <Sparkles className="h-3.5 w-3.5" /> Reprocessar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Somente campos faltantes / obrigatórios */}
      {showMissingFields && (
        <div className="border-t bg-muted/20 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(row.missing.includes("Local") || row.status === "ready") && (
            <FieldBlock label="Local *" warn={!row.storage_location.trim()}>
              <SectorCombobox
                value={row.storage_location}
                onChange={(v) => onPatch({ storage_location: v })}
                placeholder="Escolha o setor…"
                size="sm"
              />
            </FieldBlock>
          )}
          {row.missing.includes("Validade") && (
            <FieldBlock label="⚠ Validade não encontrada" warn>
              <Input
                type="date"
                min={todayPlus(0)}
                value={row.validity_date}
                onChange={(e) => onPatch({ validity_date: e.target.value })}
                className="h-8 text-xs"
              />
            </FieldBlock>
          )}
          {row.missing.includes("Lote") && (
            <FieldBlock label="⚠ Lote não encontrado" warn>
              <div className="flex gap-1">
                <Input
                  value={row.batch}
                  onChange={(e) => onPatch({ batch: e.target.value })}
                  placeholder="Digitar lote…"
                  className="h-8 text-xs"
                />
                <Button
                  type="button" size="sm" variant="outline" className="h-8 text-[10px] px-2"
                  onClick={() => onPatch({ batch: `MSC-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${Math.floor(Math.random()*900+100)}` })}
                >
                  Gerar
                </Button>
              </div>
            </FieldBlock>
          )}
          {/* Conservação sempre editável quando algo faltou (opcional) */}
          {row.status === "needs_info" && (
            <FieldBlock label="Conservação">
              <Select value={row.conservation} onValueChange={(v) => onPatch({ conservation: v as Conservation })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="refrigerated">Refrigerado</SelectItem>
                  <SelectItem value="frozen">Congelado</SelectItem>
                  <SelectItem value="ambient">Ambiente</SelectItem>
                  <SelectItem value="hot">Quente</SelectItem>
                </SelectContent>
              </Select>
            </FieldBlock>
          )}
        </div>
      )}
    </div>
  );
}

function FieldBlock({ label, warn, children }: { label: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={cn("text-[11px] font-medium", warn ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{label}</label>
      {children}
    </div>
  );
}
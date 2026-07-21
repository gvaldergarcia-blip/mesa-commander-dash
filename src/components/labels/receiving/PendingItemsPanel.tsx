import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, Sparkles, CheckCircle2, AlertTriangle, PenLine } from "lucide-react";
import { SectorCombobox } from "@/components/labels/SectorCombobox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
// Setores agora vêm do SectorCombobox (unifica defaults + custom).
import { useReceipts } from "@/hooks/useReceipts";
import { cn } from "@/lib/utils";

type Conservation = "refrigerated" | "frozen" | "ambient" | "hot";

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
  matched: boolean;
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
  const [scanning, setScanning] = useState(false);
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
      matched: false,
    })),
  );
  const fileRef = useRef<HTMLInputElement | null>(null);

  const patch = (itemId: string, upd: Partial<PendingRow>) =>
    setRows((rs) => rs.map((r) => (r.itemId === itemId ? { ...r, ...upd } : r)));

  const handlePhotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setScanning(true);
    try {
      const photos = await Promise.all(
        Array.from(files).slice(0, 12).map(async (f) => ({
          base64: await fileToBase64(f),
          mime_type: f.type,
        })),
      );
      const candidates = rows.map((r) => r.rawName);
      const { data, error } = await supabase.functions.invoke("parse-labels-batch", {
        body: { photos, candidates },
      });
      if (error) throw error;

      const results = (data?.results ?? []) as Array<{ labels: any[] }>;
      const allLabels = results.flatMap((r) => r.labels || []);

      // 1) Só aceita labels com match válido e confiança mínima.
      // 2) Para cada rawName candidato, escolhe UM único melhor label (maior confiança).
      //    Isso impede que a IA aloque os MESMOS dados de uma foto para vários itens.
      const bestByRaw = new Map<string, any>();
      for (const lb of allLabels) {
        if (!lb?.match || typeof lb.match !== "string") continue;
        if ((lb.confidence ?? 0) < 0.6) continue;
        // Rejeita quando o "match" da IA não bate minimamente com o rawName
        // (evita que uma foto seja aplicada a itens que ela não representa).
        const sim = nameSimilarity(lb.match, lb.name || "");
        if (sim < 0.34 && (lb.confidence ?? 0) < 0.85) continue;
        const prev = bestByRaw.get(lb.match);
        if (!prev || (lb.confidence ?? 0) > (prev.confidence ?? 0)) {
          bestByRaw.set(lb.match, lb);
        }
      }

      let filled = 0;
      setRows((rs) => {
        const used = new Set<string>();
        return rs.map((r) => {
          if (r.matched) return r; // já preenchido antes, não sobrescreve
          const lb = bestByRaw.get(r.rawName);
          if (!lb) return r;
          if (used.has(r.rawName)) return r;
          // Cinturão-e-suspensórios: confere similaridade contra o próprio
          // nome bruto do item (evita alocar dados de uma foto ao item errado).
          const sim = nameSimilarity(r.rawName, lb.name || lb.match || "");
          if (sim < 0.25) return r;
          used.add(r.rawName);
          filled++;
          return {
            ...r,
            matched: true,
            confidence: lb.confidence || 0,
            name: lb.name || r.name,
            validity_date: lb.expires_at || r.validity_date,
            conservation: lb.conservation || r.conservation,
            sif: lb.sif || r.sif,
            batch: lb.batch || r.batch,
            brand: lb.brand || r.brand,
            weight: lb.weight || r.weight,
          };
        });
      });
      const missing = rows.filter((r) => !r.matched).length - filled;
      if (filled === 0) {
        toast.warning("Nenhuma etiqueta reconhecida nas fotos.");
      } else if (missing > 0) {
        toast.success(
          `${filled} etiqueta(s) casada(s). Faltam ${missing} — envie mais fotos ou preencha manualmente.`,
        );
      } else {
        toast.success(`${filled} etiqueta(s) casada(s) automaticamente.`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao ler fotos");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const markManual = (itemId: string) =>
    patch(itemId, { matched: true, confidence: 1 });

  const readyRows = useMemo(
    () => rows.filter((r) => r.matched && r.storage_location.trim()),
    [rows],
  );
  const matchedButNoLocal = useMemo(
    () => rows.filter((r) => r.matched && !r.storage_location.trim()),
    [rows],
  );
  const unmatchedRows = useMemo(
    () => rows.filter((r) => !r.matched),
    [rows],
  );

  const handleFinalize = async () => {
    if (matchedButNoLocal.length > 0) {
      toast.error(`Preencha o Local em ${matchedButNoLocal.length} item(ns).`);
      return;
    }
    if (readyRows.length === 0) {
      toast.warning("Nenhum item pronto. Envie fotos ou preencha manualmente pelo menos um item.");
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
    const processed = new Set(readyRows.map((r) => r.itemId));
    setRows((rs) => rs.filter((r) => !processed.has(r.itemId)));
    if (unmatchedRows.length === 0) onDone?.();
  };

  const confBadge = (r: PendingRow) => {
    if (!r.matched) return <Badge variant="outline" className="text-[10px]">A completar</Badge>;
    if (r.confidence >= 0.85) return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> {Math.round(r.confidence * 100)}%</Badge>;
    if (r.confidence >= 0.6) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Revisar {Math.round(r.confidence * 100)}%</Badge>;
    return <Badge variant="destructive" className="text-[10px]">Baixa {Math.round(r.confidence * 100)}%</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold">Envie fotos das etiquetas dos fabricantes</p>
          <p className="text-xs text-muted-foreground">
            Pode ser várias fotos, ou uma foto com vários produtos. Só depois dessas fotos a IA casa cada etiqueta com o item recebido e preenche os dados. Você confirma o <strong>Local</strong>.
          </p>
        </div>
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={scanning} className="gap-1.5">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {scanning ? "Lendo..." : "Enviar fotos"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handlePhotos(e.target.files)}
        />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="col-span-4">Produto</div>
          <div className="col-span-2">Validade</div>
          <div className="col-span-2">Conservação</div>
          <div className="col-span-3">Local *</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.itemId} className={cn(
              "grid grid-cols-12 gap-2 px-3 py-2 items-center",
              !r.matched && "bg-muted/30",
              r.matched && !r.storage_location.trim() && "bg-amber-500/5",
            )}>
              <div className="col-span-4 min-w-0">
                <div className="font-medium text-sm truncate">{r.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.rawName !== r.name && <span>({r.rawName})</span>}
                  {r.brand && <span> · {r.brand}</span>}
                  {r.batch && <span> · Lote {r.batch}</span>}
                  {r.weight && <span> · {r.weight}</span>}
                  {r.sif && <span> · SIF {r.sif}</span>}
                </div>
              </div>
              <div className="col-span-2">
                <Input
                  type="date"
                  min={todayPlus(0)}
                  value={r.validity_date}
                  onChange={(e) => patch(r.itemId, { validity_date: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-2">
                <Select value={r.conservation} onValueChange={(v) => patch(r.itemId, { conservation: v as Conservation })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refrigerated">Refrigerado</SelectItem>
                    <SelectItem value="frozen">Congelado</SelectItem>
                    <SelectItem value="ambient">Ambiente</SelectItem>
                    <SelectItem value="hot">Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <SectorCombobox
                  value={r.storage_location}
                  onChange={(v) => patch(r.itemId, { storage_location: v })}
                  placeholder="Local…"
                  size="sm"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <div className="flex items-center gap-1">
                  {!r.matched && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] gap-1"
                      onClick={() => markManual(r.itemId)}
                      title="Preencher manualmente (sem foto)"
                    >
                      <PenLine className="h-3 w-3" /> Manual
                    </Button>
                  )}
                  {confBadge(r)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {readyRows.length} pronto(s) para gerar etiqueta ·{" "}
          {unmatchedRows.length > 0
            ? `${unmatchedRows.length} aguardando foto/manual (ficarão pendentes)`
            : "nenhum item aguardando"}
          {matchedButNoLocal.length > 0 && ` · ${matchedButNoLocal.length} sem Local`}
        </p>
        <Button
          size="lg"
          onClick={handleFinalize}
          disabled={isBulkResolving || readyRows.length === 0 || matchedButNoLocal.length > 0}
          className="gap-2"
        >
          {isBulkResolving && <Loader2 className="h-4 w-4 animate-spin" />}
          Finalizar {readyRows.length > 0 ? `(${readyRows.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
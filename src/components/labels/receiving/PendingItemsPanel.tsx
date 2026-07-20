import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PRODUCT_CATEGORIES } from "@/lib/labels/categories";
import { DEFAULT_SECTORS } from "@/lib/labels/sectors";
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

  const readyCount = rows.filter((r) => r.storage_location.trim()).length;

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

      let filled = 0;
      const results = (data?.results ?? []) as Array<{ labels: any[] }>;
      const allLabels = results.flatMap((r) => r.labels || []);
      // aplica cada label na melhor row correspondente
      for (const lb of allLabels) {
        if (!lb.match) continue;
        const target = rows.find((r) => r.rawName === lb.match);
        if (!target) continue;
        setRows((rs) =>
          rs.map((r) =>
            r.itemId === target.itemId
              ? {
                  ...r,
                  matched: true,
                  confidence: lb.confidence || r.confidence,
                  name: lb.name || r.name,
                  validity_date: lb.expires_at || r.validity_date,
                  conservation: lb.conservation || r.conservation,
                  sif: lb.sif || r.sif,
                  batch: lb.batch || r.batch,
                  brand: lb.brand || r.brand,
                  weight: lb.weight || r.weight,
                }
              : r,
          ),
        );
        filled++;
      }
      if (filled === 0) toast.warning("Nenhuma etiqueta reconhecida nas fotos.");
      else toast.success(`${filled} etiqueta(s) casada(s) automaticamente.`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao ler fotos");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const missingLocationRows = useMemo(
    () => rows.filter((r) => !r.storage_location.trim()),
    [rows],
  );

  const handleFinalize = async () => {
    if (missingLocationRows.length > 0) {
      toast.error(`Preencha o Local em ${missingLocationRows.length} item(ns) pendente(s).`);
      return;
    }
    await bulkResolvePending({
      receiptId,
      supplierId: supplierId ?? null,
      items: rows.map((r) => ({
        itemId: r.itemId,
        rawName: r.rawName,
        name: r.name,
        validity_days: daysUntil(r.validity_date),
        conservation_method: r.conservation,
        category: r.category || null,
        storage_location: r.storage_location || null,
        sif: r.sif || null,
        batch: r.batch || null,
      })),
    });
    onDone?.();
  };

  const confBadge = (r: PendingRow) => {
    if (!r.matched) return <Badge variant="outline" className="text-[10px]">Aguardando foto</Badge>;
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
            Pode ser várias fotos, ou uma foto com vários produtos. A IA casa cada etiqueta com o item recebido e preenche tudo automaticamente. Você só confirma <strong>Setor</strong> e <strong>Local</strong>.
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
          <div className="col-span-3">Produto</div>
          <div className="col-span-2">Validade</div>
          <div className="col-span-2">Conservação</div>
          <div className="col-span-2">Setor</div>
          <div className="col-span-2">Local *</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.itemId} className={cn(
              "grid grid-cols-12 gap-2 px-3 py-2 items-center",
              !r.storage_location.trim() && "bg-amber-500/5",
            )}>
              <div className="col-span-3 min-w-0">
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
              <div className="col-span-2">
                <Select value={r.category || undefined} onValueChange={(v) => patch(r.itemId, { category: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input
                  value={r.storage_location}
                  onChange={(e) => patch(r.itemId, { storage_location: e.target.value })}
                  placeholder="Câmara Fria…"
                  list="mesaclik-sectors-panel"
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                {confBadge(r)}
              </div>
            </div>
          ))}
          <datalist id="mesaclik-sectors-panel">
            {DEFAULT_SECTORS.map((s) => (<option key={s} value={s} />))}
          </datalist>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {readyCount}/{rows.length} pronto(s) · {missingLocationRows.length > 0 ? `${missingLocationRows.length} sem Local` : "todos com Local preenchido"}
        </p>
        <Button
          size="lg"
          onClick={handleFinalize}
          disabled={isBulkResolving || missingLocationRows.length > 0}
          className="gap-2"
        >
          {isBulkResolving && <Loader2 className="h-4 w-4 animate-spin" />}
          Finalizar recebimento
        </Button>
      </div>
    </div>
  );
}
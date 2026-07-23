import { useCallback, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, Upload, Loader2, Sparkles, X, CheckCircle2, AlertTriangle,
  Image as ImageIcon, Wand2, Trash2, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useReceipts } from "@/hooks/useReceipts";
import { useLabelSuppliers } from "@/hooks/useLabelSuppliers";
import { SectorCombobox } from "@/components/labels/SectorCombobox";

type Conservation = "refrigerated" | "frozen" | "ambient" | "hot";
const MAX_PHOTOS = 40;
const REQUIRED_FIELDS = ["name", "expires_at", "batch", "sif"] as const;
const FIELD_LABEL: Record<string, string> = {
  name: "Nome",
  expires_at: "Validade",
  batch: "Lote",
  sif: "SIF",
  brand: "Marca",
  weight: "Peso",
  barcode: "Código de barras",
  category: "Categoria",
  conservation: "Conservação",
  storage_location: "Local",
};

interface Photo { id: string; file: File; previewUrl: string }

interface ProductGroup {
  id: string;
  photo_ids: string[];
  name: string | null;
  brand: string | null;
  barcode: string | null;
  weight: string | null;
  expires_at: string | null;
  batch: string | null;
  sif: string | null;
  category: string | null;
  conservation: Conservation | null;
  storage_location: string;
  confidence: Record<string, number>;
  missing: string[];
  is_meat: boolean; // se tem SIF/carne — deixamos SIF opcional se marcado
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });
}
function parseWeightString(s: string | null | undefined) {
  if (!s) return null as null | { value: number; unit: string };
  const m = String(s).replace(",", ".").toLowerCase().match(/([\d.]+)\s*(kg|g|l|ml)/);
  if (!m) return null;
  const v = Number(m[1]);
  if (!isFinite(v) || v <= 0) return null;
  return { value: v, unit: m[2] };
}
function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 1;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 1;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const t = new Date();
  const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.max(1, Math.round((target - today) / 86400000));
}
function genMesaLot() {
  const d = new Date();
  const s = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MESA-${s}-${rnd}`;
}

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function PhotoFirstReceiving({ open, onOpenChange }: Props) {
  const { createReceipt, bulkResolvePending, isCreating, isBulkResolving } = useReceipts();
  const { suppliers = [] } = useLabelSuppliers() as any;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [groups, setGroups] = useState<ProductGroup[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("none");
  const [reference, setReference] = useState("");
  const camRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]); setGroups(null); setScanning(false);
    setSupplierId("none"); setReference("");
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const remaining = Math.max(0, MAX_PHOTOS - photos.length);
    if (remaining === 0) { toast.warning(`Limite de ${MAX_PHOTOS} fotos por lote.`); return; }
    const next = Array.from(list).slice(0, remaining).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f, previewUrl: URL.createObjectURL(f),
    }));
    if (list.length > remaining) toast.info(`Adicionadas ${next.length} foto(s). Limite: ${MAX_PHOTOS}.`);
    setPhotos((ps) => [...ps, ...next]);
    setGroups(null); // convida a reanalisar
  };

  const removePhoto = (id: string) => {
    setPhotos((ps) => {
      const p = ps.find((x) => x.id === id); if (p) URL.revokeObjectURL(p.previewUrl);
      return ps.filter((x) => x.id !== id);
    });
    setGroups(null);
  };

  const analyze = useCallback(async () => {
    if (!photos.length) return;
    setScanning(true);
    try {
      const payload = await Promise.all(photos.map(async (p) => ({
        base64: await fileToBase64(p.file), mime_type: p.file.type,
      })));
      const { data, error } = await supabase.functions.invoke("group-photos-into-products", {
        body: { photos: payload },
      });
      if (error) throw error;
      const products = (data?.products ?? []) as any[];
      const built: ProductGroup[] = products.map((p, idx) => {
        const idxs: number[] = Array.isArray(p.photo_indices) ? p.photo_indices : [];
        const ids = idxs.map((i) => photos[i]?.id).filter(Boolean) as string[];
        return {
          id: `g-${Date.now()}-${idx}`,
          photo_ids: ids,
          name: p.name, brand: p.brand, barcode: p.barcode, weight: p.weight,
          expires_at: p.expires_at, batch: p.batch, sif: p.sif, category: p.category,
          conservation: p.conservation ?? "refrigerated",
          storage_location: "",
          confidence: p.confidence || {},
          missing: Array.isArray(p.missing) ? p.missing : [],
          is_meat: !!p.sif,
        };
      });
      if (!built.length) toast.warning("A IA não conseguiu identificar nenhum produto. Tente adicionar fotos com melhor luz.");
      setGroups(built);
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar as fotos");
    } finally { setScanning(false); }
  }, [photos]);

  const patchGroup = (id: string, upd: Partial<ProductGroup>) =>
    setGroups((gs) => gs?.map((g) => g.id === id ? { ...g, ...upd, missing: recomputeMissing({ ...g, ...upd }) } : g) ?? gs);

  const removeGroup = (id: string) => setGroups((gs) => gs?.filter((g) => g.id !== id) ?? gs);

  const readyGroups = useMemo(() => groups?.filter((g) => g.missing.length === 0) ?? [], [groups]);
  const pendingGroups = useMemo(() => groups?.filter((g) => g.missing.length > 0) ?? [], [groups]);

  const canFinalize = readyGroups.length > 0 && !isCreating && !isBulkResolving && !scanning;

  const finalize = async () => {
    if (!readyGroups.length) { toast.warning("Nenhum produto pronto."); return; }
    // 1) cria o recebimento com todos os produtos prontos
    const supplier_id = supplierId === "none" ? null : supplierId;
    const receipt = await createReceipt({
      supplier_id,
      source: "manual",
      reference: reference || undefined,
      items: readyGroups.map((g) => {
        const w = parseWeightString(g.weight);
        return {
          raw_name: g.name || "Produto",
          quantity: 1,
          unit: "un",
          weight: w?.value ?? null,
          weight_unit: w?.unit ?? null,
        };
      }),
    } as any);
    // 2) mapeia items criados pelo raw_name (posicional)
    const items = (receipt?.items ?? []) as Array<{ id: string; raw_name: string }>;
    // itens vêm agregados por raw_name — usamos ordem do array como pareamento posicional
    const bulkItems = readyGroups.map((g, i) => {
      const item = items[i];
      const w = parseWeightString(g.weight);
      return {
        itemId: item?.id ?? "",
        rawName: g.name || "Produto",
        name: g.name || "Produto",
        validity_days: daysUntil(g.expires_at),
        conservation_method: (g.conservation || "refrigerated") as Conservation,
        category: g.category || null,
        storage_location: g.storage_location || null,
        sif: g.sif || null,
        batch: g.batch || null,
        weight: w?.value ?? null,
        weight_unit: w?.unit ?? null,
      };
    }).filter((x) => x.itemId);
    if (!bulkItems.length) { toast.error("Falha ao vincular itens do recebimento."); return; }
    await bulkResolvePending({ receiptId: receipt.id, supplierId: supplier_id, items: bulkItems });
    toast.success(`${bulkItems.length} etiqueta(s) prontas.`);
    reset(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Recebimento por fotos
          </DialogTitle>
          <DialogDescription>
            Fotografe as embalagens (frente, verso, lote, validade, SIF...). A IA agrupa por produto e extrai tudo sozinha.
          </DialogDescription>
        </DialogHeader>

        {/* Meta opcional */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fornecedor (opcional)</label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Sem fornecedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem fornecedor</SelectItem>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Referência (opcional)</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="NF, pedido..." />
          </div>
        </div>

        {/* Upload area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={cn(
            "rounded-xl border-2 border-dashed p-5 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10",
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Solte fotos aqui ou escolha uma opção abaixo</p>
            <p className="text-xs text-muted-foreground">
              Uma mesma embalagem pode aparecer em várias fotos. A IA agrupa e cruza tudo.
            </p>
            <div className="flex gap-2 mt-1 flex-wrap justify-center">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => camRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                <Camera className="h-4 w-4" /> Câmera
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => filesRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
                <Upload className="h-4 w-4" /> Arquivos
              </Button>
              <input ref={camRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
                     onChange={(e) => { addFiles(e.target.files); if (camRef.current) camRef.current.value = ""; }} />
              <input ref={filesRef} type="file" accept="image/*" multiple className="hidden"
                     onChange={(e) => { addFiles(e.target.files); if (filesRef.current) filesRef.current.value = ""; }} />
            </div>
          </div>
        </div>

        {/* Thumbnails */}
        {photos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {photos.length} foto(s) selecionada(s)
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => { photos.forEach(p => URL.revokeObjectURL(p.previewUrl)); setPhotos([]); setGroups(null); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Limpar
                </Button>
                <Button size="sm" onClick={analyze} disabled={scanning || !photos.length} className="gap-2">
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {groups ? "Reanalisar" : "Analisar fotos"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                  <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(p.id)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultado */}
        {scanning && (
          <div className="flex items-center gap-2 justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Agrupando e lendo as fotos...
          </div>
        )}

        {groups && groups.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <SummaryCard label="Produtos" value={groups.length} tone="neutral" />
              <SummaryCard label="Prontos" value={readyGroups.length} tone="success" />
              <SummaryCard label="Faltam dados" value={pendingGroups.length} tone="warning" />
            </div>
            <div className="space-y-3">
              {groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  photos={photos}
                  onPatch={(u) => patchGroup(g.id, u)}
                  onRemove={() => removeGroup(g.id)}
                  onGenerateLot={() => patchGroup(g.id, { batch: genMesaLot() })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Rodapé */}
        {groups && (
          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background/95 backdrop-blur border-t flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{readyGroups.length}</span> pronto(s)
              {pendingGroups.length > 0 && <> · <span className="text-amber-600">{pendingGroups.length} aguardando confirmação</span></>}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={finalize} disabled={!canFinalize} className="gap-2">
                {(isCreating || isBulkResolving) && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-4 w-4" />
                Gerar {readyGroups.length} etiqueta(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function recomputeMissing(g: ProductGroup): string[] {
  const miss: string[] = [];
  if (!g.name?.trim()) miss.push("name");
  if (!g.expires_at) miss.push("expires_at");
  if (!g.batch?.trim()) miss.push("batch");
  if (!g.is_meat) {
    // SIF só é obrigatório para produtos de origem animal — se o usuário marcar
    // "não se aplica", removemos da obrigação. Por padrão, se veio SIF da IA
    // ou o usuário indicou is_meat=true, exigimos.
  } else if (!g.sif?.trim()) miss.push("sif");
  return miss;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "success" | "warning" }) {
  const cls = {
    neutral: "bg-background border-border text-foreground",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2", cls)}>
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function ConfPill({ conf }: { conf: number }) {
  if (!conf) return null;
  const pct = Math.round(conf * 100);
  const tone = pct >= 85 ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    : pct >= 60 ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
    : "bg-rose-500/15 text-rose-700 border-rose-500/30";
  return <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0", tone)}>{pct}%</Badge>;
}

function GroupCard({
  group, photos, onPatch, onRemove, onGenerateLot,
}: {
  group: ProductGroup; photos: Photo[];
  onPatch: (u: Partial<ProductGroup>) => void;
  onRemove: () => void;
  onGenerateLot: () => void;
}) {
  const previews = group.photo_ids.map((pid) => photos.find((p) => p.id === pid)).filter(Boolean) as Photo[];
  const ready = group.missing.length === 0;
  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden",
      ready ? "border-emerald-500/40" : "border-amber-500/40",
    )}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-base leading-tight">
                {group.name || <span className="text-muted-foreground italic">Sem nome identificado</span>}
              </h4>
              {ready
                ? <Badge className="gap-1 text-[11px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30"><CheckCircle2 className="h-3 w-3" /> Pronto</Badge>
                : <Badge className="gap-1 text-[11px] bg-amber-500/15 text-amber-700 border-amber-500/30"><AlertTriangle className="h-3 w-3" /> Falta {group.missing.map((m) => FIELD_LABEL[m] || m).join(", ")}</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              {group.brand && <span>{group.brand}</span>}
              {group.weight && <span>· {group.weight}</span>}
              {group.sif && <span>· SIF {group.sif} <ConfPill conf={group.confidence?.sif ?? 0} /></span>}
              {group.barcode && <span>· EAN {group.barcode}</span>}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive h-8" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Fotos do grupo */}
        {previews.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {previews.map((p) => (
              <img key={p.id} src={p.previewUrl} alt="" className="h-14 w-14 object-cover rounded-md border shrink-0" />
            ))}
          </div>
        )}

        {/* Campos: nome sempre editável se faltando; demais expostos quando faltando */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {group.missing.includes("name") && (
            <FieldEditor label="Nome do produto" value={group.name || ""} onChange={(v) => onPatch({ name: v })} />
          )}
          {group.missing.includes("expires_at") && (
            <FieldEditor label="Validade" type="date" value={group.expires_at || ""} onChange={(v) => onPatch({ expires_at: v })} />
          )}
          {group.missing.includes("batch") && (
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Lote</label>
              <div className="flex gap-1.5">
                <Input value={group.batch || ""} onChange={(e) => onPatch({ batch: e.target.value })} placeholder="Digite ou gere um lote MesaClik" />
                <Button type="button" size="sm" variant="outline" onClick={onGenerateLot} title="Gerar lote interno MesaClik">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Não encontrado nas fotos. Gere um lote interno de rastreabilidade se o fornecedor não informou.
              </p>
            </div>
          )}
          {group.missing.includes("sif") && (
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">SIF/SISP/SIM</label>
              <div className="flex gap-1.5 items-start">
                <Input value={group.sif || ""} onChange={(e) => onPatch({ sif: e.target.value.replace(/\D/g, "") })} placeholder="Número do registro" />
                <Button type="button" size="sm" variant="ghost" onClick={() => onPatch({ is_meat: false })} title="Não se aplica">
                  Não se aplica
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Configurações complementares (sempre visíveis, mas resumidas) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/50">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Local (setor)</label>
            <SectorCombobox value={group.storage_location} onChange={(v) => onPatch({ storage_location: v })} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Conservação</label>
            <Select value={group.conservation || "refrigerated"} onValueChange={(v) => onPatch({ conservation: v as Conservation })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="refrigerated">Refrigerado</SelectItem>
                <SelectItem value="frozen">Congelado</SelectItem>
                <SelectItem value="ambient">Ambiente</SelectItem>
                <SelectItem value="hot">Quente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Categoria</label>
            <Input value={group.category || ""} onChange={(e) => onPatch({ category: e.target.value })} placeholder="Ex: Laticínio" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldEditor({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
import { useCallback, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, Upload, Loader2, Sparkles, X, CheckCircle2, AlertTriangle,
  Image as ImageIcon, Wand2, Trash2, RefreshCw, Hash, Pencil, MinusCircle, ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useReceipts } from "@/hooks/useReceipts";
import { useLabelSuppliers } from "@/hooks/useLabelSuppliers";
import { SectorCombobox } from "@/components/labels/SectorCombobox";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { useRegisterPrints } from "@/hooks/useDiaryReceipts";
import { printLabelsMany, type PrintLabelData } from "@/components/labels/LabelPrintSheet";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { getSiteBaseUrl } from "@/config/site-url";
import {
  photoFirstStore,
  usePhotoFirstState,
  type PfGroup,
  type PfPhoto,
  type Conservation as PfConservation,
} from "./photoFirstStore";

const CONSERVATION_LABEL: Record<string, string> = {
  refrigerated: "REFRIGERADO",
  frozen: "CONGELADO",
  ambient: "AMBIENTE",
  hot: "QUENTE",
};

type Conservation = "refrigerated" | "frozen" | "ambient" | "hot";
const MAX_PHOTOS = 40;
const REQUIRED_FIELDS = ["name", "expires_at", "batch", "sif"] as const;
const FIELD_LABEL: Record<string, string> = {
  name: "Nome",
  expires_at: "Validade",
  batch: "Definir lote",
  sif: "SIF",
  brand: "Marca",
  weight: "Peso",
  barcode: "Código de barras",
  category: "Categoria",
  conservation: "Conservação",
  storage_location: "Local",
};

type Photo = PfPhoto;
type ProductGroup = PfGroup;

/** Redimensiona e comprime a imagem no navegador antes de enviar à IA.
 *  Reduz drasticamente o payload (evita "Memory limit exceeded" na edge function). */
async function compressImageToBase64(
  file: File,
  maxDim = 1400,
  quality = 0.72,
): Promise<{ base64: string; mime_type: string }> {
  // SVG/heic e casos raros — devolve original em base64.
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return { base64: btoa(bin), mime_type: file.type || "image/jpeg" };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Falha ao decodificar imagem"));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { base64: dataUrl.split(",")[1] || "", mime_type: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
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
/** Gera um lote interno sequencial no formato `LT-YYYYMMDD-NNN`.
 *  A contagem é feita sobre os grupos da sessão atual para manter numeração
 *  crescente e legível dentro de um mesmo recebimento. */
function genInternalLot(existingGroups: ProductGroup[] | null): string {
  const d = new Date();
  const s = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `LT-${s}-`;
  const used = (existingGroups || [])
    .map((g) => g.batch || "")
    .filter((b) => b.startsWith(prefix))
    .map((b) => parseInt(b.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

interface Props { open: boolean; onOpenChange: (v: boolean) => void }

export function PhotoFirstReceiving({ open, onOpenChange }: Props) {
  const { createReceipt, bulkResolvePending, isCreating, isBulkResolving } = useReceipts();
  const { suppliers = [] } = useLabelSuppliers() as any;
  const { restaurant } = useRestaurant();
  const { activeEmployees } = useLabelEmployees();
  const registerPrints = useRegisterPrints();
  // Estado persistente entre aberturas/fechamentos do dialog e trocas de aba.
  const { photos, groups, supplierId, reference, scanning, finalizedReceiptId } = usePhotoFirstState();
  const setPhotos = (updater: Photo[] | ((prev: Photo[]) => Photo[])) =>
    photoFirstStore.set((s) => ({ photos: typeof updater === "function" ? (updater as any)(s.photos) : updater }));
  const setGroups = (updater: ProductGroup[] | null | ((prev: ProductGroup[] | null) => ProductGroup[] | null)) =>
    photoFirstStore.set((s) => ({ groups: typeof updater === "function" ? (updater as any)(s.groups) : updater }));
  const setScanning = (v: boolean) => photoFirstStore.set({ scanning: v });
  const setSupplierId = (v: string) => photoFirstStore.set({ supplierId: v });
  const setReference = (v: string) => photoFirstStore.set({ reference: v });
  const setFinalizedReceiptId = (v: string | null) => photoFirstStore.set({ finalizedReceiptId: v });
  const [reprinting, setReprinting] = useState(false);
  const camRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => { photoFirstStore.reset(); };

  const hasWork = photos.length > 0 || (groups?.length ?? 0) > 0;
  /** Fechar sem perder trabalho: só reseta se realmente for cancelar. */
  const handleClose = (nextOpen: boolean) => {
    if (nextOpen) { onOpenChange(true); return; }
    if (hasWork) {
      // Não descarta ao clicar no X — apenas oculta o diálogo, mantendo tudo em memória.
      onOpenChange(false);
      return;
    }
    onOpenChange(false);
  };
  const handleCancel = () => {
    if (hasWork && !confirm("Descartar todas as fotos e dados coletados?")) return;
    reset(); onOpenChange(false);
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
    // Sobe cada foto para o bucket em segundo plano — habilita sync
    // celular ↔ computador. Não bloqueia a UI.
    for (const p of next) void photoFirstStore.uploadPhoto(p.id, p.file);
  };

  const removePhoto = (id: string) => {
    setPhotos((ps) => {
      const p = ps.find((x) => x.id === id);
      if (p) {
        if (p.file) { try { URL.revokeObjectURL(p.previewUrl); } catch { /* noop */ } }
        void photoFirstStore.removeRemotePhoto(p.storage_path);
      }
      return ps.filter((x) => x.id !== id);
    });
    setGroups(null);
  };

  const analyze = useCallback(async () => {
    if (!photos.length) return;
    setScanning(true);
    try {
      // Fotos hidratadas de outro dispositivo não têm `file` local — nesse
      // caso, baixamos o preview assinado antes de comprimir.
      const payload = await Promise.all(
        photos.map(async (p) => {
          if (p.file) return compressImageToBase64(p.file);
          const res = await fetch(p.previewUrl);
          const blob = await res.blob();
          const f = new File([blob], `${p.id}.jpg`, { type: blob.type || "image/jpeg" });
          return compressImageToBase64(f);
        }),
      );
      // Envia em chunks de até 8 fotos por chamada para respeitar o limite de memória
      // da edge function (16+ fotos grandes estouram). Depois consolida os grupos.
      const CHUNK = 8;
      const chunks: Array<{ base64: string; mime_type: string }[]> = [];
      const chunkIdx: number[][] = [];
      for (let i = 0; i < payload.length; i += CHUNK) {
        chunks.push(payload.slice(i, i + CHUNK));
        chunkIdx.push(photos.slice(i, i + CHUNK).map((_, j) => i + j));
      }
      const products: any[] = [];
      for (let c = 0; c < chunks.length; c++) {
        const { data, error } = await supabase.functions.invoke("group-photos-into-products", {
          body: { photos: chunks[c] },
        });
        if (error) throw error;
        const arr = (data?.products ?? []) as any[];
        // Re-mapear índices locais do chunk para índices globais
        const globalMap = chunkIdx[c];
        for (const p of arr) {
          const gidxs = Array.isArray(p.photo_indices)
            ? p.photo_indices.map((i: number) => globalMap[i]).filter((x: any) => typeof x === "number")
            : [];
          products.push({ ...p, photo_indices: gidxs });
        }
      }
      const built: ProductGroup[] = products.map((p, idx) => {
        const idxs: number[] = Array.isArray(p.photo_indices) ? p.photo_indices : [];
        const ids = idxs.map((i) => photos[i]?.id).filter(Boolean) as string[];
        const base: ProductGroup = {
          id: `g-${Date.now()}-${idx}`,
          photo_ids: ids,
          name: p.name, brand: p.brand, barcode: p.barcode, weight: p.weight,
          expires_at: p.expires_at, batch: p.batch, sif: p.sif, category: p.category,
          conservation: p.conservation ?? "refrigerated",
          storage_location: "",
          confidence: p.confidence || {},
          field_status: p.field_status || {},
          issues: Array.isArray(p.issues) ? p.issues : [],
          needs_review: Array.isArray(p.needs_review) ? p.needs_review : [],
          confirmed_fields: [],
          missing: Array.isArray(p.missing) ? p.missing : [],
          missing_initial: [],
          is_meat: !!p.sif,
          // Se a IA leu um lote, marcamos como do fabricante; caso contrário,
          // deixamos indefinido para o usuário escolher entre as 3 opções.
          lot_source: p.batch ? "manufacturer" : null,
          // POP começa vazio — será preenchido pelo lookup em `label_products` (abaixo).
          pop_enabled: false,
          pop_validity_value: null,
          pop_validity_unit: null,
          pop_notes: null,
          pop_existing: false,
        };
        base.missing = recomputeMissing(base);
        base.missing_initial = [...base.missing];
        return base;
      });
      if (!built.length) toast.warning("A IA não conseguiu identificar nenhum produto. Tente adicionar fotos com melhor luz.");
      // Prefill do POP consultando produtos já cadastrados (por nome, case-insensitive).
      try {
        const names = Array.from(new Set(built.map((g) => (g.name || "").trim()).filter(Boolean)));
        if (names.length) {
          const { data: existing } = await (supabase as any)
            .from("label_products")
            .select("name, manipulation_enabled, manipulation_validity_value, manipulation_validity_unit, manipulation_notes")
            .in("name", names);
          const byName = new Map<string, any>();
          for (const r of (existing || [])) byName.set(String(r.name || "").trim().toLowerCase(), r);
          for (const g of built) {
            const key = (g.name || "").trim().toLowerCase();
            const p = byName.get(key);
            if (p?.manipulation_enabled) {
              g.pop_enabled = true;
              g.pop_validity_value = p.manipulation_validity_value ?? null;
              g.pop_validity_unit = (p.manipulation_validity_unit as any) ?? null;
              g.pop_notes = p.manipulation_notes ?? null;
              g.pop_existing = true;
            }
          }
        }
      } catch (e) { console.warn("[PhotoFirstReceiving] POP prefill", e); }
      setGroups(built);
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar as fotos");
    } finally { setScanning(false); }
  }, [photos]);

  // Enquanto o usuário edita, NÃO recalculamos `missing_initial` — assim o campo
  // não some no meio da digitação. Só o status "pronto" (missing) é reavaliado.
  const patchGroup = (id: string, upd: Partial<ProductGroup>) =>
    setGroups((gs) => gs?.map((g) => {
      if (g.id !== id) return g;
      const merged = { ...g, ...upd };
      merged.missing = recomputeMissing(merged);
      return merged;
    }) ?? gs);

  const removeGroup = (id: string) => setGroups((gs) => gs?.filter((g) => g.id !== id) ?? gs);

  /** Confirma explicitamente um campo auditado (o operador assume a leitura). */
  const confirmField = (id: string, field: string, value?: string) =>
    setGroups((gs) => gs?.map((g) => {
      if (g.id !== id) return g;
      const merged: ProductGroup = {
        ...g,
        ...(value !== undefined ? ({ [field]: value || null } as any) : {}),
        confirmed_fields: Array.from(new Set([...(g.confirmed_fields || []), field])),
      };
      if (field === "batch" && value) merged.lot_source = "manufacturer";
      merged.missing = recomputeMissing(merged);
      return merged;
    }) ?? gs);

  const readyGroups = useMemo(
    () => groups?.filter((g) => g.missing.length === 0 && unverifiedFields(g).length === 0) ?? [],
    [groups],
  );
  const pendingGroups = useMemo(
    () => groups?.filter((g) => g.missing.length > 0 || unverifiedFields(g).length > 0) ?? [],
    [groups],
  );

  const canFinalize = readyGroups.length > 0 && !isCreating && !isBulkResolving && !scanning;

  /** Busca as etiquetas ativas de um recebimento e dispara impressão em lote.
   *  Reutilizado tanto no `finalize` inicial quanto no botão "Reimprimir". */
  const printFromReceipt = async (receiptId: string, supplier_id: string | null) => {
    const { data: iss } = await (supabase as any)
      .from("label_issuances")
      .select("*")
      .eq("receipt_id", receiptId)
      .eq("status", "active");
    const issuances = (iss || []) as any[];
    if (!issuances.length) { toast.info("Nenhuma etiqueta ativa para imprimir."); return 0; }
    let legal: { cnpj: string | null; cep: string | null; address: string | null } = {
      cnpj: null, cep: null, address: (restaurant as any)?.address_line ?? null,
    };
    if (restaurant?.id) {
      const { data: r } = await (supabase as any)
        .schema("mesaclik")
        .from("restaurants")
        .select("cnpj, zip_code, address_line")
        .eq("id", restaurant.id)
        .maybeSingle();
      legal = {
        cnpj: r?.cnpj || null,
        cep: r?.zip_code || null,
        address: r?.address_line || legal.address,
      };
    }
    const supplierName = supplier_id
      ? ((suppliers as any[]).find((s) => s.id === supplier_id)?.name ?? null)
      : null;
    const brandByName = new Map<string, string>();
    for (const g of (groups || [])) {
      if (g.name && g.brand) brandByName.set(g.name.trim().toLowerCase(), g.brand);
    }
    const respBySector = new Map<string, string>();
    for (const e of activeEmployees || []) {
      for (const s of e.sectors || []) if (!respBySector.has(s)) respBySector.set(s, e.name);
    }
    const jobs: PrintLabelData[] = [];
    const prints: { id: string; count: number }[] = [];
    for (const l of issuances) {
      const remaining = Math.max(0, (l.quantity || 0) - (l.printed_labels || 0));
      const qty = remaining > 0 ? remaining : (l.quantity || 1);
      const qrSvg = renderToStaticMarkup(
        <QRCodeSVG
          value={`${getSiteBaseUrl()}/etiquetas/scan/${l.unique_code}?op=1`}
          size={144}
          level="L"
          marginSize={1}
        />,
      );
      const weightLabel = l.weight != null && l.weight_unit
        ? `${String(l.weight).replace(".", ",")} ${l.weight_unit}`
        : null;
      const sector = l.storage_location ?? null;
      const nameKey = String(l.product_name || "").trim().toLowerCase();
      const brand = brandByName.get(nameKey) || supplierName;
      jobs.push({
        productName: l.product_name,
        manufactureDate: new Date(l.manufacture_date),
        expiryDate: new Date(l.expiry_date),
        responsible: l.responsible || (sector ? respBySector.get(sector) : null) || "—",
        quantity: qty,
        notes: l.notes,
        cif: l.cif,
        sif: l.sif ?? null,
        brand,
        allergens: l.allergens,
        ingredients: l.ingredients,
        conservationLabel: l.conservation_method
          ? CONSERVATION_LABEL[l.conservation_method] || null
          : null,
        storageLocation: sector,
        batch: l.batch,
        quantityWeight: weightLabel,
        restaurantName: restaurant?.name || null,
        restaurantCnpj: legal.cnpj,
        restaurantCep: legal.cep,
        restaurantAddress: legal.address,
        checklistQrSvg: qrSvg,
        checklistQrLabel: `#${l.unique_code}`,
      });
      if (remaining > 0) prints.push({ id: l.id, count: remaining });
    }
    if (prints.length) await registerPrints.mutateAsync(prints);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (jobs.length) printLabelsMany(jobs);
    return jobs.length;
  };

  const reprint = async () => {
    if (!finalizedReceiptId) return;
    setReprinting(true);
    try {
      const supplier_id = supplierId === "none" ? null : supplierId;
      const n = await printFromReceipt(finalizedReceiptId, supplier_id);
      if (n > 0) toast.success(`${n} etiqueta(s) reenviadas para impressão.`);
    } catch (e: any) {
      console.error("[PhotoFirstReceiving] reprint", e);
      toast.error("Falha ao reimprimir. Tente pelo Diário Operacional.");
    } finally { setReprinting(false); }
  };

  const concludeSession = () => {
    if (!confirm("Concluir esta sessão de recebimento? A prévia dos produtos será limpa. As etiquetas continuam disponíveis no Diário Operacional.")) return;
    reset(); onOpenChange(false);
  };

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
        lot_source: g.lot_source || (g.batch ? "manufacturer" : "none"),
        weight: w?.value ?? null,
        weight_unit: w?.unit ?? null,
        // POP de Manipulação — salvo no cadastro permanente do produto
        manipulation_enabled: !!g.pop_enabled,
        manipulation_validity_value: g.pop_enabled ? (g.pop_validity_value ?? null) : null,
        manipulation_validity_unit: g.pop_enabled ? (g.pop_validity_unit ?? null) : null,
        manipulation_notes: g.pop_enabled ? (g.pop_notes ?? null) : null,
      };
    }).filter((x) => x.itemId);
    if (!bulkItems.length) { toast.error("Falha ao vincular itens do recebimento."); return; }
    await bulkResolvePending({ receiptId: receipt.id, supplierId: supplier_id, items: bulkItems });
    // 3) marca sessão como finalizada — a sessão fica preservada até o dono
    //    clicar em "Concluir sessão". Assim, se cancelar a caixa de impressão
    //    do navegador, ele volta para a lista de produtos lidos pela IA e pode
    //    reimprimir a qualquer momento.
    setFinalizedReceiptId(receipt.id);
    try {
      const n = await printFromReceipt(receipt.id, supplier_id);
      if (n > 0) toast.success(`${n} etiqueta(s) enviadas para impressão. Cancele a impressão e clique em "Reimprimir" se precisar reenviar.`);
      else toast.success(`${bulkItems.length} etiqueta(s) prontas.`);
    } catch (e: any) {
      console.error("[PhotoFirstReceiving] print", e);
      toast.warning("Etiquetas geradas, mas falhou ao imprimir automaticamente. Use \"Reimprimir\" abaixo ou abra o Diário Operacional.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
                  onConfirmField={(f, v) => confirmField(g.id, f, v)}
                  onGenerateInternalLot={() =>
                    patchGroup(g.id, { batch: genInternalLot(groups), lot_source: "internal" })
                  }
                  onMarkNoLot={() => patchGroup(g.id, { batch: null, lot_source: "none" })}
                  onClearLot={() => patchGroup(g.id, { batch: null, lot_source: null })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Rodapé */}
        {groups && (
          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background/95 backdrop-blur border-t flex items-center justify-between gap-3 flex-wrap">
            {finalizedReceiptId ? (
              <>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Recebimento criado. Se cancelou a impressão, clique em <span className="font-semibold">Reimprimir</span>.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reprint} disabled={reprinting} className="gap-2">
                    {reprinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Reimprimir
                  </Button>
                  <Button onClick={concludeSession} className="gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Concluir sessão
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{readyGroups.length}</span> pronto(s)
                  {pendingGroups.length > 0 && <> · <span className="text-amber-600">{pendingGroups.length} aguardando confirmação</span></>}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleCancel}>Cancelar</Button>
                  <Button onClick={finalize} disabled={!canFinalize} className="gap-2">
                    {(isCreating || isBulkResolving) && <Loader2 className="h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4" />
                    Gerar {readyGroups.length} etiqueta(s)
                  </Button>
                </div>
              </>
            )}
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
  // Lote é considerado resolvido quando o usuário digitou/leu um lote OU
  // decidiu explicitamente por "sem lote" (lot_source === 'none').
  if (!g.batch?.trim() && g.lot_source !== "none") miss.push("batch");
  if (!g.is_meat) {
    // SIF só é obrigatório para produtos de origem animal — se o usuário marcar
    // "não se aplica", removemos da obrigação. Por padrão, se veio SIF da IA
    // ou o usuário indicou is_meat=true, exigimos.
  } else if (!g.sif?.trim()) miss.push("sif");
  return miss;
}

/** Campos críticos lidos pela IA que NÃO atingiram o padrão de confiança
 *  (conflito entre as duas leituras, confiança < 85% ou valor inválido) e
 *  que ainda não foram confirmados manualmente pelo operador. */
function unverifiedFields(g: ProductGroup): string[] {
  const confirmed = new Set(g.confirmed_fields || []);
  return (g.needs_review || []).filter((f) => {
    if (confirmed.has(f)) return false;
    if (f === "sif" && !g.is_meat) return false;
    if (f === "batch" && g.lot_source === "none") return false;
    // Só exige revisão de campos que realmente têm valor a validar.
    return !!(g as any)[f];
  });
}

const REASON_LABEL: Record<string, string> = {
  conflict: "Leituras divergentes",
  low_confidence: "Baixa confiança",
  invalid: "Valor inválido",
  blur: "Foto desfocada",
  glare: "Reflexo na embalagem",
  cropped: "Informação cortada",
  unreadable: "Ilegível",
  ambiguous: "Ambíguo",
  absent: "Não encontrado",
};

/** Painel de auditoria: exige confirmação humana antes de imprimir. */
function AuditPanel({
  group, onConfirm, onPatch,
}: {
  group: ProductGroup;
  onConfirm: (field: string, value?: string) => void;
  onPatch: (u: Partial<ProductGroup>) => void;
}) {
  const pending = unverifiedFields(group);
  if (!pending.length) return null;
  return (
    <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
          Confirmação obrigatória — a IA não garante estes dados
        </span>
      </div>
      {pending.map((f) => {
        const issue = (group.issues || []).find((i) => i.field === f);
        const conf = Math.round((group.confidence?.[f] ?? 0) * 100);
        return (
          <div key={f} className="rounded-md border bg-background p-2 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold">{FIELD_LABEL[f] || f}</span>
              <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 border-rose-500/30">
                {REASON_LABEL[issue?.reason || group.field_status?.[f] || "low_confidence"] || "Revisar"}
              </Badge>
              {conf > 0 && <span className="text-[10px] font-mono text-muted-foreground">confiança {conf}%</span>}
            </div>
            {issue?.hint && <p className="text-[11px] text-muted-foreground">{issue.hint}</p>}
            <div className="flex gap-1.5">
              <Input
                type={f === "expires_at" || f === "manufactured_at" ? "date" : "text"}
                value={((group as any)[f] as string) || ""}
                onChange={(e) => onPatch({ [f]: e.target.value || null } as any)}
                className="h-8 text-sm"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 shrink-0"
                disabled={!((group as any)[f])}
                onClick={() => onConfirm(f, ((group as any)[f] as string) || undefined)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Confira o valor diretamente na embalagem antes de confirmar. Se não conseguir ler, adicione uma nova foto aproximada e reanalise.
            </p>
          </div>
        );
      })}
    </div>
  );
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
  group, photos, onPatch, onRemove,
  onGenerateInternalLot, onMarkNoLot, onClearLot,
}: {
  group: ProductGroup; photos: Photo[];
  onPatch: (u: Partial<ProductGroup>) => void;
  onRemove: () => void;
  onGenerateInternalLot: () => void;
  onMarkNoLot: () => void;
  onClearLot: () => void;
}) {
  const previews = group.photo_ids.map((pid) => photos.find((p) => p.id === pid)).filter(Boolean) as Photo[];
  const ready = group.missing.length === 0;
  // Campos exibidos = os que estavam faltando no momento da análise (snapshot).
  // Assim o editor não some quando o usuário digita a 1ª letra.
  const editorFields = group.missing_initial?.length ? group.missing_initial : group.missing;
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
          {editorFields.includes("name") && (
            <FieldEditor label="Nome do produto" value={group.name || ""} onChange={(v) => onPatch({ name: v })} />
          )}
          {editorFields.includes("expires_at") && (
            <FieldEditor label="Validade" type="date" value={group.expires_at || ""} onChange={(v) => onPatch({ expires_at: v })} />
          )}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Lote</label>
              {group.lot_source && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] gap-1",
                    group.lot_source === "manufacturer" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
                    group.lot_source === "internal" && "bg-sky-500/10 text-sky-700 border-sky-500/30",
                    group.lot_source === "none" && "bg-muted text-muted-foreground",
                  )}
                >
                  {group.lot_source === "manufacturer" && "Lote do fabricante"}
                  {group.lot_source === "internal" && "Lote interno"}
                  {group.lot_source === "none" && "Sem lote"}
                </Badge>
              )}
            </div>

            {/* Estado 1 — lote resolvido (fabricante/interno): mostra o valor e permite alterar */}
            {(group.lot_source === "manufacturer" || group.lot_source === "internal") && (
              <div className="flex gap-1.5 mt-1">
                <Input
                  value={group.batch || ""}
                  onChange={(e) => onPatch({ batch: e.target.value, lot_source: "manufacturer" })}
                  placeholder="Lote"
                />
                <Button type="button" size="sm" variant="ghost" onClick={onClearLot} title="Voltar a escolher">
                  Alterar
                </Button>
              </div>
            )}

            {/* Estado 2 — decisão explícita: recebido sem lote */}
            {group.lot_source === "none" && (
              <div className="flex items-center justify-between gap-2 mt-1 p-2 rounded-md border border-dashed border-border/60 bg-muted/20">
                <p className="text-[11px] text-muted-foreground">
                  Produto recebido sem lote — o campo <span className="font-medium">Lote</span> não será impresso na etiqueta.
                </p>
                <Button type="button" size="sm" variant="ghost" onClick={onClearLot}>Alterar</Button>
              </div>
            )}

            {/* Estado 3 — indefinido: apresentar as 3 opções */}
            {!group.lot_source && (
              <div className="mt-1 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Nenhum lote foi identificado na embalagem. Como deseja continuar?
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="gap-1.5 justify-start flex-1 min-w-[160px] whitespace-nowrap"
                    onClick={onGenerateInternalLot}
                    title="MesaClik gera um lote interno LT-AAAAMMDD-NNN para rastreabilidade"
                  >
                    <Hash className="h-3.5 w-3.5" /> Gerar lote interno
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 justify-start flex-1 min-w-[180px] whitespace-nowrap"
                    onClick={() => onPatch({ lot_source: "manufacturer", batch: "" })}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Informar manualmente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 justify-start flex-1 min-w-[180px] whitespace-nowrap"
                    onClick={onMarkNoLot}
                  >
                    <MinusCircle className="h-3.5 w-3.5" /> Continuar sem lote
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-medium">Recomendado:</span> gerar um lote interno mantém a rastreabilidade completa sem inventar dados do fabricante.
                </p>
              </div>
            )}
          </div>
          {editorFields.includes("sif") && (
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

        {/* POP de Manipulação — cadastro único por produto */}
        <PopEditor group={group} onPatch={onPatch} />
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

function PopEditor({ group, onPatch }: { group: ProductGroup; onPatch: (u: Partial<ProductGroup>) => void }) {
  const [editing, setEditing] = useState(false);
  const configured = !!group.pop_enabled && !!group.pop_validity_value && !!group.pop_validity_unit;
  const showForm = editing || (!configured && !group.pop_existing) || (group.pop_enabled && !configured);
  const unitLabel = group.pop_validity_unit === "hours" ? "hora(s)" : "dia(s)";
  return (
    <div className="pt-3 mt-1 border-t border-border/50">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wide">POP de Manipulação</span>
          {configured ? (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1">
              <AlertTriangle className="h-3 w-3" /> Não configurado
            </Badge>
          )}
          {group.pop_existing && (
            <Badge variant="outline" className="text-[10px]">Já existente no cadastro</Badge>
          )}
        </div>
        {configured && !editing && (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
      </div>

      {configured && !editing && (
        <p className="text-xs text-muted-foreground">
          ✓ <span className="font-semibold text-foreground">{group.pop_validity_value}</span> {unitLabel} após manipulação
          {group.pop_notes ? <> — <span className="italic">{group.pop_notes}</span></> : null}
        </p>
      )}

      {showForm && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Validade após manipulação</label>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={group.pop_validity_value ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  const n = v === "" ? null : Math.max(1, parseInt(v, 10) || 0) || null;
                  onPatch({ pop_validity_value: n, pop_enabled: true });
                }}
                placeholder="Ex: 3, 24, 72"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Unidade</label>
              <Select
                value={group.pop_validity_unit || ""}
                onValueChange={(v) => onPatch({ pop_validity_unit: v as "hours" | "days", pop_enabled: true })}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-1">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Observações (opcional)</label>
              <Input
                value={group.pop_notes || ""}
                onChange={(e) => onPatch({ pop_notes: e.target.value, pop_enabled: true })}
                placeholder="Ex: Após abertura manter refrigerado."
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed border-l-2 border-amber-500/40 pl-2">
            A validade após manipulação deve ser definida pelo estabelecimento conforme seus Procedimentos Operacionais Padronizados (POPs),
            Manual de Boas Práticas e orientações do Responsável Técnico, quando aplicável. O MesaClik apenas armazenará e aplicará
            automaticamente essa configuração durante futuras manipulações.
          </p>
          {editing && (
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
                Fechar edição
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
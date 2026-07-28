// Store persistente (fora do React) para o fluxo "Fotografar produtos".
// Além de sobreviver ao fechamento do dialog / troca de aba, o rascunho é
// sincronizado com o Supabase (tabela public.label_receipt_drafts + bucket
// label-receipt-drafts) para que o mesmo restaurante veja o rascunho em
// qualquer dispositivo (ex.: celular fotografa → computador imprime).
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Conservation = "refrigerated" | "frozen" | "ambient" | "hot";

export interface PfPhoto {
  id: string;
  /** Presente apenas quando a foto foi capturada nesta sessão. Fotos
   *  hidratadas de outro dispositivo vêm somente com `storage_path` +
   *  `previewUrl` assinada — não podem ser reanalisadas sem baixar o
   *  arquivo de volta. */
  file?: File;
  previewUrl: string;
  /** Caminho no bucket label-receipt-drafts: `{restaurant_id}/{draft_id}/{id}.jpg` */
  storage_path?: string;
}

export interface PfGroup {
  id: string;
  photo_ids: string[];
  name: string | null;
  brand: string | null;
  barcode: string | null;
  weight: string | null;
  expires_at: string | null;
  batch: string | null;
  /** Origem do lote — usado para auditoria e para decidir se o campo já foi "resolvido":
   *  - `manufacturer`: lote impresso na embalagem (lido pela IA) ou informado manualmente.
   *  - `internal`: lote gerado pelo MesaClik (LT-YYYYMMDD-NNN).
   *  - `none`: recebimento intencionalmente sem lote.
   *  - `null`: ainda não decidido — o usuário precisa escolher. */
  lot_source: "manufacturer" | "internal" | "none" | null;
  sif: string | null;
  category: string | null;
  conservation: Conservation | null;
  storage_location: string;
  confidence: Record<string, number>;
  /** Status por campo crítico devolvido pela auditoria da IA:
   *  `verified` (duas leituras iguais + alta confiança), `single_read`,
   *  `low_confidence`, `conflict`, `invalid`, `absent`. */
  field_status?: Record<string, string>;
  /** Motivos legíveis de falha de leitura por campo. */
  issues?: Array<{ field: string; reason: string; hint: string }>;
  /** Campos críticos que a IA NÃO garante — exigem confirmação humana. */
  needs_review?: string[];
  /** Campos já confirmados/corrigidos manualmente pelo operador. */
  confirmed_fields?: string[];
  missing: string[];
  missing_initial: string[];
  is_meat: boolean;
  /** Regra do fabricante após abertura (cadastrada uma única vez por produto). */
  pop_enabled: boolean;
  pop_validity_value: number | null;
  /** `immediate` = "consumir imediatamente após aberto". */
  pop_validity_unit: "hours" | "days" | "months" | "immediate" | null;
  pop_notes: string | null;
  /** Quantas etiquetas serão impressas para este produto (definido após a análise da IA). */
  label_count?: number;
  /** Indica que o produto já possui POP salvo no cadastro (permite apenas edição opcional). */
  pop_existing: boolean;
  /** Origem da regra de validade após abertura/manipulação. */
  pop_source?: "ai" | "operator" | "manual" | null;
  /** Texto literal lido no rótulo (quando a origem for a IA). */
  pop_ai_text?: string | null;
  /** Data/hora completa informada manualmente (ISO local: yyyy-MM-ddTHH:mm). */
  pop_fixed_date?: string | null;
}

export interface PfState {
  photos: PfPhoto[];
  groups: PfGroup[] | null;
  supplierId: string;
  reference: string;
  scanning: boolean;
  /** Definido quando o recebimento já foi criado e etiquetas enviadas para impressão.
   *  Permite reimprimir sem duplicar o recebimento e mantém a sessão até o dono concluir. */
  finalizedReceiptId: string | null;
  /** ID da linha em `label_receipt_drafts`. Só é criado quando houver algo pra persistir. */
  draftId: string | null;
  /** Restaurante corrente — para saber o "escopo" do rascunho e detectar troca. */
  restaurantId: string | null;
  /** True depois que o carregamento remoto inicial terminou (mesmo sem rascunho). */
  hydrated: boolean;
  /** Está no meio de um upload/persistência remota. */
  syncing: boolean;
  /** Último recebimento registrado nesta sessão (apenas local, nunca bloqueia
   *  a entrada de novos produtos). Permite "Imprimir agora" logo após registrar. */
  lastReceipt: { id: string; count: number; at: number; supplierId: string } | null;
}

let state: PfState = {
  photos: [],
  groups: null,
  supplierId: "none",
  reference: "",
  scanning: false,
  finalizedReceiptId: null,
  draftId: null,
  restaurantId: null,
  hydrated: false,
  syncing: false,
  lastReceipt: null,
};

const listeners = new Set<() => void>();

function emit() { for (const l of listeners) l(); }

const BUCKET = "label-receipt-drafts";
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Quando true, mudanças no store não disparam persist remoto (útil durante hydrate). */
let suspendPersist = false;

function newId() {
  return (globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
}

/** Comprime uma imagem para um Blob JPEG antes de subir para o bucket. */
async function compressToBlob(file: File, maxDim = 1400, quality = 0.72): Promise<Blob> {
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) return file;
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
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality);
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Serializa o estado atual em um payload para o banco (sem `file`/`previewUrl`). */
function serialize(s: PfState) {
  return {
    supplier_id: s.supplierId && s.supplierId !== "none" ? s.supplierId : null,
    reference: s.reference || null,
    groups: s.groups ?? [],
    photos: s.photos
      .filter((p) => !!p.storage_path)
      .map((p) => ({ id: p.id, storage_path: p.storage_path })),
    finalized_receipt_id: s.finalizedReceiptId,
  };
}

async function ensureDraftId(restaurantId: string): Promise<string> {
  if (state.draftId) return state.draftId;
  const id = newId();
  state = { ...state, draftId: id };
  emit();
  return id;
}

async function persistNow() {
  const s = state;
  if (!s.restaurantId || !s.hydrated) return;
  try {
    state = { ...state, syncing: true }; emit();
    // Se não há trabalho, apague o rascunho remoto ao invés de guardar vazio.
    if (s.photos.length === 0 && (!s.groups || s.groups.length === 0)) {
      if (s.draftId) {
        await supabase.from("label_receipt_drafts" as any).delete().eq("restaurant_id", s.restaurantId);
      }
      state = { ...state, draftId: null, syncing: false }; emit();
      return;
    }
    const draftId = await ensureDraftId(s.restaurantId);
    const { data: userData } = await supabase.auth.getUser();
    const payload: any = {
      id: draftId,
      restaurant_id: s.restaurantId,
      updated_by: userData?.user?.id ?? null,
      ...serialize(s),
    };
    const { error } = await supabase
      .from("label_receipt_drafts" as any)
      .upsert(payload, { onConflict: "restaurant_id" });
    if (error) console.warn("[photoFirstStore] persist error", error);
  } catch (e) {
    console.warn("[photoFirstStore] persist exception", e);
  } finally {
    state = { ...state, syncing: false }; emit();
  }
}

function schedulePersist() {
  if (suspendPersist) return;
  if (!state.restaurantId || !state.hydrated) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void persistNow(); }, 800);
}

/** Gera signed URLs para as fotos hidratadas do bucket. */
async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!paths.length) return out;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error || !data) return out;
  for (let i = 0; i < data.length; i++) {
    const path = paths[i];
    const url = (data[i] as any)?.signedUrl;
    if (path && url) out[path] = url;
  }
  return out;
}

export const photoFirstStore = {
  get(): PfState { return state; },
  set(patch: Partial<PfState> | ((s: PfState) => Partial<PfState>)) {
    const p = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...p };
    emit();
    // Persistência remota reativa — só grava campos "de dados" (ignora flags UI).
    const touchesData =
      "photos" in (p as any) ||
      "groups" in (p as any) ||
      "supplierId" in (p as any) ||
      "reference" in (p as any) ||
      "finalizedReceiptId" in (p as any);
    if (touchesData) schedulePersist();
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  reset(opts?: { keepLastReceipt?: boolean }) {
    for (const p of state.photos) {
      if (p.file) { try { URL.revokeObjectURL(p.previewUrl); } catch { /* noop */ } }
    }
    const restaurantId = state.restaurantId;
    const draftId = state.draftId;
    const photos = state.photos;
    state = {
      photos: [], groups: null, supplierId: "none", reference: "",
      scanning: false, finalizedReceiptId: null,
      draftId: null, restaurantId, hydrated: state.hydrated, syncing: false,
      lastReceipt: opts?.keepLastReceipt ? state.lastReceipt : null,
    };
    emit();
    // Remove tudo do remoto — melhor esforço, não bloqueia a UI.
    void (async () => {
      try {
        if (restaurantId) {
          await supabase.from("label_receipt_drafts" as any).delete().eq("restaurant_id", restaurantId);
        }
        const paths = photos.map((p) => p.storage_path).filter(Boolean) as string[];
        if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      } catch (e) { console.warn("[photoFirstStore] remote clear", e); }
    })();
  },
  hasWork(): boolean {
    return state.photos.length > 0 || (state.groups?.length ?? 0) > 0;
  },

  /** Carrega rascunho do restaurante atual (chamado ao montar a aba). */
  async hydrate(restaurantId: string) {
    if (!restaurantId) return;
    // Se trocou de restaurante, limpa a sessão local (não apaga remota do outro).
    if (state.restaurantId && state.restaurantId !== restaurantId) {
      for (const p of state.photos) if (p.file) { try { URL.revokeObjectURL(p.previewUrl); } catch { /* noop */ } }
      state = {
        photos: [], groups: null, supplierId: "none", reference: "",
        scanning: false, finalizedReceiptId: null,
        draftId: null, restaurantId: null, hydrated: false, syncing: false,
        lastReceipt: null,
      };
      emit();
    }
    suspendPersist = true;
    try {
      const { data, error } = await supabase
        .from("label_receipt_drafts" as any)
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (error) console.warn("[photoFirstStore] hydrate", error);
      if (data) {
        const row: any = data;
        const rawPhotos: Array<{ id: string; storage_path: string }> = Array.isArray(row.photos) ? row.photos : [];
        const paths = rawPhotos.map((p) => p.storage_path).filter(Boolean);
        const signed = await signPhotos(paths);
        const photos: PfPhoto[] = rawPhotos.map((p) => ({
          id: p.id,
          storage_path: p.storage_path,
          previewUrl: signed[p.storage_path] || "",
        }));
        state = {
          ...state,
          restaurantId,
          hydrated: true,
          draftId: row.id ?? null,
          supplierId: row.supplier_id ?? "none",
          reference: row.reference ?? "",
          groups: Array.isArray(row.groups) ? row.groups : null,
          photos,
          finalizedReceiptId: row.finalized_receipt_id ?? null,
        };
      } else {
        state = { ...state, restaurantId, hydrated: true };
      }
      emit();
    } finally {
      suspendPersist = false;
    }
  },

  /** Envia um File para o bucket e registra `storage_path` na foto correspondente. */
  async uploadPhoto(photoId: string, file: File): Promise<void> {
    const restaurantId = state.restaurantId;
    if (!restaurantId) return;
    try {
      const draftId = await ensureDraftId(restaurantId);
      const blob = await compressToBlob(file);
      const path = `${restaurantId}/${draftId}/${photoId}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) { console.warn("[photoFirstStore] upload", error); return; }
      state = {
        ...state,
        photos: state.photos.map((p) => (p.id === photoId ? { ...p, storage_path: path } : p)),
      };
      emit();
      schedulePersist();
    } catch (e) {
      console.warn("[photoFirstStore] upload exception", e);
    }
  },

  /** Remove a foto do bucket (se houver caminho). Best-effort. */
  async removeRemotePhoto(storagePath: string | undefined) {
    if (!storagePath) return;
    try { await supabase.storage.from(BUCKET).remove([storagePath]); } catch { /* noop */ }
  },

  /** Força um flush imediato (bypassa o debounce). */
  flushPersist() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } void persistNow(); },
};

export function usePhotoFirstState(): PfState {
  return useSyncExternalStore(photoFirstStore.subscribe, photoFirstStore.get, photoFirstStore.get);
}
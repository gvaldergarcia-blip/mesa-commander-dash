// Store persistente (fora do React) para o fluxo "Fotografar produtos".
// Assim o usuário pode fechar o dialog no X, trocar de aba, e voltar
// encontrando fotos, grupos e edições intactos.
import { useSyncExternalStore } from "react";

export type Conservation = "refrigerated" | "frozen" | "ambient" | "hot";

export interface PfPhoto { id: string; file: File; previewUrl: string }

export interface PfGroup {
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
  missing_initial: string[];
  is_meat: boolean;
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
}

let state: PfState = {
  photos: [],
  groups: null,
  supplierId: "none",
  reference: "",
  scanning: false,
  finalizedReceiptId: null,
};

const listeners = new Set<() => void>();

function emit() { for (const l of listeners) l(); }

export const photoFirstStore = {
  get(): PfState { return state; },
  set(patch: Partial<PfState> | ((s: PfState) => Partial<PfState>)) {
    const p = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...p };
    emit();
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  reset() {
    for (const p of state.photos) { try { URL.revokeObjectURL(p.previewUrl); } catch { /* noop */ } }
    state = { photos: [], groups: null, supplierId: "none", reference: "", scanning: false, finalizedReceiptId: null };
    emit();
  },
  hasWork(): boolean {
    return state.photos.length > 0 || (state.groups?.length ?? 0) > 0;
  },
};

export function usePhotoFirstState(): PfState {
  return useSyncExternalStore(photoFirstStore.subscribe, photoFirstStore.get, photoFirstStore.get);
}
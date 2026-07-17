// Setores padrão do restaurante (armazenamento físico).
// Substituem a antiga divisão por categoria de alimento.
// Cada restaurante pode adicionar setores próprios digitando um novo valor
// em "Setor" no momento do recebimento — o sistema aprende automaticamente.

export const DEFAULT_SECTORS = [
  "Câmara Fria",
  "Congelados",
  "Estoque Seco",
  "Bar",
  "Confeitaria",
  "Pré-preparo",
  "Padaria",
  "Cozinha Quente",
] as const;

// Paleta consistente por setor (hash simples para setores customizados).
const SECTOR_HEX: Record<string, string> = {
  "Câmara Fria": "#4299E1",
  "Congelados": "#0BC5EA",
  "Estoque Seco": "#D69E2E",
  "Bar": "#B794F4",
  "Confeitaria": "#ED64A6",
  "Pré-preparo": "#F6AD55",
  "Padaria": "#ECC94B",
  "Cozinha Quente": "#E53E3E",
};

const FALLBACK_PALETTE = [
  "#48BB78",
  "#9F7AEA",
  "#38B2AC",
  "#F6AD55",
  "#4FD1C5",
  "#F687B3",
];

export const NO_SECTOR_HEX = "#718096";

export function getSectorHex(sector?: string | null): string {
  if (!sector) return NO_SECTOR_HEX;
  if (SECTOR_HEX[sector]) return SECTOR_HEX[sector];
  let hash = 0;
  for (let i = 0; i < sector.length; i++) hash = (hash * 31 + sector.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

// Junta os setores padrão com quaisquer setores customizados encontrados no
// storage_location dos produtos etiquetados.
export function mergeSectors(custom: (string | null | undefined)[]): string[] {
  const set = new Set<string>(DEFAULT_SECTORS);
  for (const c of custom) {
    const v = (c || "").trim();
    if (v) set.add(v);
  }
  return Array.from(set);
}
/** Normalização de unidades do Estoque Digital.
 *  Base interna: 'g' (peso), 'ml' (volume), 'un' (contagem).
 *  Isso evita erros de cálculo ao misturar kg/g ou l/ml no mesmo produto. */
export type StockBase = 'g' | 'ml' | 'un';

const MAP: Record<string, { base: StockBase; factor: number }> = {
  kg: { base: 'g', factor: 1000 },
  quilo: { base: 'g', factor: 1000 },
  g: { base: 'g', factor: 1 },
  gr: { base: 'g', factor: 1 },
  grama: { base: 'g', factor: 1 },
  gramas: { base: 'g', factor: 1 },
  mg: { base: 'g', factor: 0.001 },
  l: { base: 'ml', factor: 1000 },
  lt: { base: 'ml', factor: 1000 },
  litro: { base: 'ml', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
};

export function normalizeUnit(unit?: string | null): { base: StockBase; factor: number } {
  const u = (unit || '').toLowerCase().trim();
  return MAP[u] ?? { base: 'un', factor: 1 };
}

/** Converte uma quantidade para a unidade base interna. */
export function toBase(quantity: number, unit?: string | null): { base: StockBase; value: number } {
  const { base, factor } = normalizeUnit(unit);
  return { base, value: (Number(quantity) || 0) * factor };
}

const nf = (v: number, d = 3) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });

/** Formata um saldo na unidade mais legível para a cozinha. */
export function formatBase(value: number, base: StockBase): string {
  if (base === 'g') return Math.abs(value) >= 1000 ? `${nf(value / 1000)} kg` : `${nf(value, 0)} g`;
  if (base === 'ml') return Math.abs(value) >= 1000 ? `${nf(value / 1000)} L` : `${nf(value, 0)} ml`;
  return `${nf(value, 2)} un`;
}

/** Formata quantidade + unidade digitadas pelo operador (Recebimento). */
export function formatQty(quantity: number, unit?: string | null): string {
  const u = (unit || 'un').toLowerCase().trim();
  return `${nf(Number(quantity) || 0)} ${u}`;
}

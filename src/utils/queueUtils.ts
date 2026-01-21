/**
 * Utilitários para gerenciamento de filas por grupo
 * 
 * A fila é organizada em filas paralelas por tamanho de grupo:
 * - 1-2 pessoas
 * - 3-4 pessoas
 * - 5-6 pessoas
 * - 7+ pessoas
 */

export type SizeGroup = '1-2' | '3-4' | '5-6' | '7+';

/**
 * Retorna o grupo de tamanho para um party_size
 */
export function getSizeGroup(partySize: number): SizeGroup {
  if (partySize >= 1 && partySize <= 2) return '1-2';
  if (partySize >= 3 && partySize <= 4) return '3-4';
  if (partySize >= 5 && partySize <= 6) return '5-6';
  return '7+';
}

/**
 * Verifica se um party_size pertence a um grupo específico
 */
export function matchesSizeGroup(partySize: number, group: SizeGroup): boolean {
  switch (group) {
    case '1-2': return partySize >= 1 && partySize <= 2;
    case '3-4': return partySize >= 3 && partySize <= 4;
    case '5-6': return partySize >= 5 && partySize <= 6;
    case '7+': return partySize >= 7;
    default: return false;
  }
}

/**
 * Retorna rótulo amigável para o grupo
 */
export function getSizeGroupLabel(group: SizeGroup): string {
  switch (group) {
    case '1-2': return '1–2 pessoas';
    case '3-4': return '3–4 pessoas';
    case '5-6': return '5–6 pessoas';
    case '7+': return '7+ pessoas';
    default: return group;
  }
}

/**
 * Lista de todos os grupos de tamanho
 */
export const ALL_SIZE_GROUPS: SizeGroup[] = ['1-2', '3-4', '5-6', '7+'];

/**
 * Tipo para posição calculada por grupo
 */
export type GroupPositions = {
  [K in SizeGroup]: Map<string, number>;
};

/**
 * Calcula posições para todas as entradas, organizadas por grupo
 * Cada grupo tem sua própria sequência de posições (1, 2, 3...)
 */
export function calculateGroupPositions<T extends { entry_id: string; people: number; status: string; created_at: string }>(
  entries: T[]
): GroupPositions {
  const positions: GroupPositions = {
    '1-2': new Map(),
    '3-4': new Map(),
    '5-6': new Map(),
    '7+': new Map(),
  };

  // Agrupar entradas por grupo de tamanho, apenas as que estão aguardando
  const waitingByGroup: { [K in SizeGroup]: T[] } = {
    '1-2': [],
    '3-4': [],
    '5-6': [],
    '7+': [],
  };

  entries
    .filter(e => e.status === 'waiting')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach(entry => {
      const group = getSizeGroup(entry.people);
      waitingByGroup[group].push(entry);
    });

  // Calcular posição dentro de cada grupo
  for (const group of ALL_SIZE_GROUPS) {
    waitingByGroup[group].forEach((entry, idx) => {
      positions[group].set(entry.entry_id, idx + 1);
    });
  }

  return positions;
}

/**
 * Obtém a posição de uma entrada específica dentro do seu grupo
 */
export function getPositionInGroup<T extends { entry_id: string; people: number; status: string; created_at: string }>(
  entryId: string,
  partySize: number,
  entries: T[]
): number | null {
  const group = getSizeGroup(partySize);
  const positions = calculateGroupPositions(entries);
  return positions[group].get(entryId) || null;
}

/**
 * Conta quantos grupos estão aguardando por tamanho
 */
export function countWaitingByGroup<T extends { people: number; status: string }>(
  entries: T[]
): { [K in SizeGroup]: number } {
  const counts: { [K in SizeGroup]: number } = {
    '1-2': 0,
    '3-4': 0,
    '5-6': 0,
    '7+': 0,
  };

  entries
    .filter(e => e.status === 'waiting')
    .forEach(entry => {
      const group = getSizeGroup(entry.people);
      counts[group]++;
    });

  return counts;
}

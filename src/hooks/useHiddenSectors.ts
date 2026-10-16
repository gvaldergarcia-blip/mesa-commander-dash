import { useCallback, useEffect, useState } from 'react';
import { useRestaurantId } from '@/contexts/RestaurantContext';

// Setores ocultados manualmente pelo restaurante (preferência de exibição).
// Guardado localmente por restaurante — não apaga dados operacionais.
export function useHiddenSectors() {
  const restaurantId = useRestaurantId();
  const storageKey = `mesaclik:hidden-sectors:${restaurantId || 'anon'}`;
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setHidden(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setHidden([]);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: string[]) => {
      setHidden(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const hideSector = useCallback(
    (sector: string) => persist(Array.from(new Set([...hidden, sector]))),
    [hidden, persist],
  );

  const restoreAll = useCallback(() => persist([]), [persist]);

  // Setores criados manualmente pelo restaurante (cards próprios).
  const customKey = `mesaclik:custom-sectors:${restaurantId || 'anon'}`;
  const [custom, setCustom] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(customKey);
      setCustom(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setCustom([]);
    }
  }, [customKey]);

  const addSector = useCallback(
    (name: string) => {
      const v = name.trim().replace(/\s+/g, ' ');
      if (!v) return;
      const next = Array.from(new Set([...custom, v]));
      setCustom(next);
      try { localStorage.setItem(customKey, JSON.stringify(next)); } catch { /* ignore */ }
      if (hidden.includes(v)) persist(hidden.filter((h) => h !== v));
    },
    [custom, customKey, hidden, persist],
  );

  return { hidden, hideSector, restoreAll, custom, addSector };
}
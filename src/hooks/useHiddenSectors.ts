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

  return { hidden, hideSector, restoreAll };
}
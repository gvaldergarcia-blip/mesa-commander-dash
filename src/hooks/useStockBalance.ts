import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurantId } from '@/contexts/RestaurantContext';
import { toBase, formatBase, type StockBase } from '@/lib/labels/stockUnits';

/** Eventos que ADICIONAM saldo (o estoque nasce no Recebimento). */
export const ENTRY_EVENTS = ['receipt', 'production', 'transfer', 'adjustment'];
/** Eventos que REDUZEM saldo (baixa por uso / perda via QR Code da etiqueta). */
export const EXIT_EVENTS = ['consumption', 'loss', 'discharge', 'waste'];

export interface StockBalance {
  productId: string;
  base: StockBase;
  /** Saldo na unidade base interna (g / ml / un). */
  value: number;
  entered: number;
  exited: number;
  label: string;
  lastEntryAt: string | null;
  lastMovementAt: string | null;
}

/**
 * ESTOQUE DIGITAL QUANTITATIVO.
 * Saldo = entradas registradas no Recebimento (Computar) − baixas posteriores.
 * Fonte única: public.label_stock_movements — nunca um segundo estoque.
 */
export function useStockBalance() {
  const restaurantId = useRestaurantId();

  const query = useQuery({
    queryKey: ['label_stock_balance', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('label_stock_movements')
        .select('product_id, event_type, quantity, unit, occurred_at, notes, receipt_id')
        .eq('restaurant_id', restaurantId)
        .not('product_id', 'is', null)
        .order('occurred_at', { ascending: false })
        .limit(5000);
      if (error) throw error;

      const map = new Map<string, StockBalance>();
      for (const m of (data || []) as any[]) {
        const isEntry = ENTRY_EVENTS.includes(m.event_type);
        const isExit = EXIT_EVENTS.includes(m.event_type);
        if (!isEntry && !isExit) continue;
        const { base, value } = toBase(Number(m.quantity) || 0, m.unit);
        const cur =
          map.get(m.product_id) ??
          { productId: m.product_id, base, value: 0, entered: 0, exited: 0, label: '', lastEntryAt: null, lastMovementAt: null };
        if (!cur.lastMovementAt) cur.lastMovementAt = m.occurred_at;
        // Mantém a base do primeiro movimento; converte se divergir de forma incompatível.
        const v = cur.base === base ? value : Number(m.quantity) || 0;
        if (!cur.lastMovementAt) cur.lastMovementAt = m.occurred_at;
        if (isEntry) {
          cur.entered += v;
          cur.value += v;
          if (!cur.lastEntryAt) cur.lastEntryAt = m.occurred_at;
        } else {
          cur.exited += v;
          cur.value -= v;
        }
        map.set(m.product_id, cur);
      }
      for (const b of map.values()) b.label = formatBase(b.value, b.base);
      return map;
    },
  });

  return {
    balances: query.data ?? new Map<string, StockBalance>(),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

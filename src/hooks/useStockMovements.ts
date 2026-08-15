import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurantId } from '@/contexts/RestaurantContext';

export interface StockMovement {
  id: string;
  event_type: string;
  quantity: number;
  unit: string | null;
  occurred_at: string;
  notes: string | null;
  receipt_id: string | null;
  issuance_id: string | null;
}

/** Histórico de movimentações de um produto (rastreabilidade do saldo). */
export function useStockMovements(productId: string | null) {
  const restaurantId = useRestaurantId();

  const query = useQuery({
    queryKey: ['label_stock_movements', restaurantId, productId],
    enabled: !!restaurantId && !!productId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('label_stock_movements')
        .select('id, event_type, quantity, unit, occurred_at, notes, receipt_id, issuance_id')
        .eq('restaurant_id', restaurantId)
        .eq('product_id', productId)
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as StockMovement[];
    },
  });

  return { movements: query.data ?? [], isLoading: query.isLoading };
}

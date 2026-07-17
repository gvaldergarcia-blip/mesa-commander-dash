import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurantId } from '@/contexts/RestaurantContext';
import { toast } from 'sonner';

export interface StockStatus {
  id: string;
  restaurant_id: string;
  product_id: string;
  status: 'ok' | 'falta';
  marked_by_employee_id: string | null;
  marked_by_name: string | null;
  marked_at: string;
  notes: string | null;
  weight_grams: number | null;
  sector: string | null;
}

export function useStockStatus() {
  const restaurantId = useRestaurantId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['product_stock_status', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_stock_status')
        .select('*')
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      return (data || []) as StockStatus[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async (input: {
      product_id: string;
      product_name: string;
      status: 'ok' | 'falta';
      employee_id?: string | null;
      employee_name?: string | null;
      weight_grams?: number | null;
      sector?: string | null;
    }) => {
      if (!restaurantId) throw new Error('Restaurante não identificado');
      const payload = {
        restaurant_id: restaurantId,
        product_id: input.product_id,
        status: input.status,
        marked_by_employee_id: input.employee_id ?? null,
        marked_by_name: input.employee_name ?? null,
        marked_at: new Date().toISOString(),
        weight_grams: input.weight_grams ?? null,
        sector: input.sector ?? null,
      };
      const { error } = await (supabase as any)
        .from('product_stock_status')
        .upsert(payload, { onConflict: 'restaurant_id,product_id' });
      if (error) throw error;

      // fire-and-forget log
      await (supabase as any).from('stock_check_logs').insert({
        restaurant_id: restaurantId,
        product_id: input.product_id,
        product_name: input.product_name,
        status: input.status,
        marked_by_employee_id: input.employee_id ?? null,
        marked_by_name: input.employee_name ?? null,
        weight_grams: input.weight_grams ?? null,
        sector: input.sector ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product_stock_status', restaurantId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao marcar estoque'),
  });

  const statusMap = new Map<string, StockStatus>();
  for (const s of query.data || []) statusMap.set(s.product_id, s);

  return {
    statuses: query.data || [],
    statusMap,
    missingProducts: (query.data || []).filter((s) => s.status === 'falta'),
    isLoading: query.isLoading,
    setStatus: setStatus.mutateAsync,
    isMutating: setStatus.isPending,
  };
}
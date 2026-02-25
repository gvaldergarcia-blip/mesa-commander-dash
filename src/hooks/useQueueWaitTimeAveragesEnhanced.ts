import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type WaitTimeAveragesMap = {
  [key: string]: number | null;
};

/**
 * Hook para buscar tempos médios de espera por faixa de tamanho de grupo
 * Separado em: dados de hoje e dados históricos (últimos 7 dias)
 * Usa RPC SECURITY DEFINER para bypass de RLS
 */
export function useQueueWaitTimeAveragesEnhanced(restaurantId: string) {
  const [todayAverages, setTodayAverages] = useState<WaitTimeAveragesMap>({});
  const [historicalAverages, setHistoricalAverages] = useState<WaitTimeAveragesMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchAverages = async () => {
      try {
        setLoading(true);

        const { data, error } = await (supabase as any)
          .schema('mesaclik')
          .rpc('get_queue_wait_time_averages_enhanced', {
            p_restaurant_id: restaurantId,
          });

        if (error) {
          console.error('Error fetching wait time averages:', error);
          setLoading(false);
          return;
        }

        const todayMap: WaitTimeAveragesMap = {};
        const historicalMap: WaitTimeAveragesMap = {};

        if (data && Array.isArray(data)) {
          data.forEach((row: { size_range: string; avg_wait_time_min: number; sample_count: number; period: string }) => {
            if (row.period === 'today') {
              todayMap[row.size_range] = row.avg_wait_time_min;
            } else if (row.period === 'historical') {
              historicalMap[row.size_range] = row.avg_wait_time_min;
            }
          });
        }

        setTodayAverages(todayMap);
        setHistoricalAverages(historicalMap);
      } catch (error) {
        console.error('Error fetching wait time averages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAverages();
  }, [restaurantId]);

  return {
    todayAverages,
    historicalAverages,
    loading,
  };
}

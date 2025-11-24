import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type WaitTimeAverage = {
  size_range: string;
  avg_wait_time_min: number;
  sample_count: number;
};

type WaitTimeAveragesMap = {
  '1-2'?: number;
  '3-4'?: number;
  '5-6'?: number;
  '7+'?: number;
};

/**
 * Hook para buscar tempos médios de espera por faixa de tamanho de grupo
 * Baseado em dados históricos dos últimos 30 dias
 */
export function useQueueWaitTimeAverages(restaurantId: string) {
  const [averages, setAverages] = useState<WaitTimeAveragesMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAverages = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .schema('mesaclik')
          .rpc('get_queue_wait_time_averages', {
            p_restaurant_id: restaurantId
          });

        if (error) throw error;

        // Converter array para map para fácil acesso
        const averagesMap: WaitTimeAveragesMap = {};
        (data as WaitTimeAverage[])?.forEach(item => {
          // Só incluir se tiver pelo menos 5 amostras para ser confiável
          if (item.sample_count >= 5) {
            averagesMap[item.size_range as keyof WaitTimeAveragesMap] = item.avg_wait_time_min;
          }
        });

        setAverages(averagesMap);
      } catch (error) {
        console.error('Erro ao buscar tempos médios:', error);
        setAverages({});
      } finally {
        setLoading(false);
      }
    };

    fetchAverages();
  }, [restaurantId]);

  /**
   * Retorna o tempo médio para um tamanho específico de grupo
   * @param partySize - Número de pessoas no grupo
   * @returns Tempo médio em minutos ou null se não houver dados suficientes
   */
  const getAverageForSize = (partySize: number): number | null => {
    let range: keyof WaitTimeAveragesMap;
    
    if (partySize <= 2) range = '1-2';
    else if (partySize <= 4) range = '3-4';
    else if (partySize <= 6) range = '5-6';
    else range = '7+';

    return averages[range] ?? null;
  };

  return {
    averages,
    loading,
    getAverageForSize,
  };
}

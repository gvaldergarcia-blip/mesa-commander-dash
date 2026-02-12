import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type WaitTimeAveragesMap = {
  [key: string]: number | null;
};

/**
 * Hook para buscar tempos médios de espera por faixa de tamanho de grupo
 * Separado em: dados de hoje e dados históricos (últimos 7 dias)
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

        // Get queue_id for this restaurant
        const { data: queueData, error: queueError } = await (supabase as any)
          .schema('mesaclik')
          .from('queues')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (queueError || !queueData) {
          console.log('No queue found for restaurant');
          setLoading(false);
          return;
        }

        const queueId = queueData.id;

        // Fetch TODAY's data
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: todayData, error: todayError } = await (supabase as any)
          .schema('mesaclik')
          .from('queue_entries')
          .select('party_size, created_at, seated_at')
          .eq('queue_id', queueId)
          .eq('status', 'seated')
          .not('seated_at', 'is', null)
          .gte('created_at', todayStart.toISOString());

        if (todayError) {
          console.error('Error fetching today data:', todayError);
        }

        // Calculate today's averages
        const todayMap: WaitTimeAveragesMap = {};
        if (todayData && todayData.length > 0) {
          const todayByRange: { [key: string]: number[] } = {};
          
          todayData.forEach((entry: any) => {
            const range = getSizeRange(entry.party_size);
            const waitMinutes = calculateWaitMinutes(entry.created_at, entry.seated_at);
            
            if (waitMinutes !== null && waitMinutes > 0) {
              if (!todayByRange[range]) {
                todayByRange[range] = [];
              }
              todayByRange[range].push(waitMinutes);
            }
          });

          Object.entries(todayByRange).forEach(([range, times]) => {
            if (times.length > 0) {
              todayMap[range] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
            }
          });
        }
        setTodayAverages(todayMap);

        // Fetch HISTORICAL data (last 7 days, excluding today)
        const yesterdayEnd = new Date();
        yesterdayEnd.setHours(0, 0, 0, 0);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const { data: historicalData, error: historicalError } = await (supabase as any)
          .schema('mesaclik')
          .from('queue_entries')
          .select('party_size, created_at, seated_at')
          .eq('queue_id', queueId)
          .eq('status', 'seated')
          .not('seated_at', 'is', null)
          .gte('created_at', sevenDaysAgo.toISOString())
          .lt('created_at', yesterdayEnd.toISOString());

        if (historicalError) {
          console.error('Error fetching historical data:', historicalError);
        }

        // Calculate historical averages
        const historicalMap: WaitTimeAveragesMap = {};
        if (historicalData && historicalData.length > 0) {
          const historicalByRange: { [key: string]: number[] } = {};
          
          historicalData.forEach((entry: any) => {
            const range = getSizeRange(entry.party_size);
            const waitMinutes = calculateWaitMinutes(entry.created_at, entry.seated_at);
            
            if (waitMinutes !== null && waitMinutes > 0) {
              if (!historicalByRange[range]) {
                historicalByRange[range] = [];
              }
              historicalByRange[range].push(waitMinutes);
            }
          });

          Object.entries(historicalByRange).forEach(([range, times]) => {
            if (times.length > 0) {
              historicalMap[range] = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
            }
          });
        }
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

function getSizeRange(partySize: number): string {
  if (partySize <= 2) return '1-2';
  if (partySize <= 4) return '3-4';
  if (partySize <= 6) return '5-6';
  return '7+';
}

function calculateWaitMinutes(createdAt: string, seatedAt: string): number | null {
  if (!createdAt || !seatedAt) return null;
  
  const created = new Date(createdAt);
  const seated = new Date(seatedAt);
  const diffMs = seated.getTime() - created.getTime();
  
  if (diffMs < 0) return null;
  
  return Math.round(diffMs / 60000); // Convert to minutes
}

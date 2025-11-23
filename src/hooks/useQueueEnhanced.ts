import { useEffect, useState } from 'react';
import { useQueue } from './useQueue';
import { getCustomerVipStatus, CustomerVipStatus } from '@/utils/customerUtils';

/**
 * Hook aprimorado que adiciona informações VIP aos clientes da fila
 */

type QueueEntryEnhanced = {
  entry_id: string;
  queue_id: string;
  customer_name: string;
  phone: string;
  email?: string;
  people: number;
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show';
  notes?: string;
  position?: number;
  called_at?: string;
  seated_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
  vipStatus?: CustomerVipStatus;
};

export function useQueueEnhanced() {
  const queueData = useQueue();
  const [enhancedEntries, setEnhancedEntries] = useState<QueueEntryEnhanced[]>([]);
  const [loadingVip, setLoadingVip] = useState(false);

  useEffect(() => {
    if (queueData.queueEntries.length === 0) {
      setEnhancedEntries([]);
      return;
    }

    const enhanceEntries = async () => {
      setLoadingVip(true);
      try {
        const enhanced = await Promise.all(
          queueData.queueEntries.map(async (entry) => {
            const vipStatus = await getCustomerVipStatus(entry.phone);
            return {
              ...entry,
              vipStatus,
            };
          })
        );
        setEnhancedEntries(enhanced);
      } catch (error) {
        console.error('Erro ao calcular status VIP:', error);
        // Fallback: retornar sem dados VIP
        setEnhancedEntries(queueData.queueEntries.map(e => ({ ...e, vipStatus: undefined })));
      } finally {
        setLoadingVip(false);
      }
    };

    enhanceEntries();
  }, [queueData.queueEntries]);

  return {
    ...queueData,
    queueEntries: enhancedEntries,
    loadingVip,
  };
}

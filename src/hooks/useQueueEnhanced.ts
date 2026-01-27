import { useEffect, useRef, useState } from 'react';
import { useQueue, QueueEntry } from './useQueue';
import { getCustomerVipStatus, CustomerVipStatus } from '@/utils/customerUtils';

/**
 * Hook aprimorado que adiciona informações VIP aos clientes da fila
 */

type QueueEntryEnhanced = QueueEntry & {
  vipStatus?: CustomerVipStatus;
};

export function useQueueEnhanced() {
  const queueData = useQueue();
  const [enhancedEntries, setEnhancedEntries] = useState<QueueEntryEnhanced[]>([]);
  const [loadingVip, setLoadingVip] = useState(false);

  // Cache para não refazer a mesma consulta de VIP a cada atualização de realtime
  const vipCacheRef = useRef<Map<string, CustomerVipStatus>>(new Map());
  // Evita race-condition: se a fila atualizar durante o Promise.all, ignoramos o resultado antigo
  const requestIdRef = useRef(0);

  const isValidPhone = (phone: unknown) => {
    if (typeof phone !== 'string') return false;
    const p = phone.trim();
    if (!p) return false;
    // placeholder usado em alguns registros de teste
    if (p === '—' || p === '-') return false;
    return true;
  };

  useEffect(() => {
    const entries = queueData.queueEntries;

    // 1) Atualiza a lista IMEDIATAMENTE (posição/status não dependem de VIP)
    setEnhancedEntries(
      entries.map((entry) => ({
        ...entry,
        vipStatus: isValidPhone(entry.phone) ? vipCacheRef.current.get(entry.phone) : undefined,
      }))
    );

    if (entries.length === 0) {
      setLoadingVip(false);
      return;
    }

    // 2) Buscar VIP apenas do que faltar (em background)
    const phonesToFetch = Array.from(
      new Set(
        entries
          .map((e) => e.phone)
          .filter((p): p is string => isValidPhone(p) && !vipCacheRef.current.has(p))
      )
    );

    if (phonesToFetch.length === 0) {
      setLoadingVip(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoadingVip(true);

    (async () => {
      const results = await Promise.all(
        phonesToFetch.map(async (phone) => {
          const vipStatus = await getCustomerVipStatus(phone);
          return [phone, vipStatus] as const;
        })
      );

      // Se a fila mudou enquanto estávamos buscando VIP, ignorar resultado antigo
      if (requestIdRef.current !== requestId) return;

      for (const [phone, status] of results) {
        vipCacheRef.current.set(phone, status);
      }

      // Reaplica VIP em cima da lista mais recente
      setEnhancedEntries(
        queueData.queueEntries.map((entry) => ({
          ...entry,
          vipStatus: isValidPhone(entry.phone) ? vipCacheRef.current.get(entry.phone) : undefined,
        }))
      );
    })()
      .catch((error) => {
        console.error('Erro ao calcular status VIP:', error);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setLoadingVip(false);
        }
      });
  }, [queueData.queueEntries]);

  return {
    ...queueData,
    queueEntries: enhancedEntries,
    loadingVip,
    clearQueue: queueData.clearQueue,
  };
}

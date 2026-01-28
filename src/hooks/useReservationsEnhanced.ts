import { useEffect, useState, useRef, useMemo } from 'react';
import { useReservations, Reservation } from './useReservations';
import { supabase } from '@/lib/supabase/client';

/**
 * Hook aprimorado que adiciona informações VIP aos clientes das reservas
 * Otimizado para evitar flicker e requisições excessivas
 */

export type CustomerVipStatus = {
  isVip: boolean;
  queueCompleted: number;
  reservationsCompleted: number;
  totalVisitsCompleted: number;
};

export type ReservationEnhanced = Reservation & {
  vipStatus?: CustomerVipStatus;
};

// Cache de VIP status para evitar requisições repetidas
const vipCache = new Map<string, CustomerVipStatus>();

export function useReservationsEnhanced() {
  const reservationData = useReservations();
  const [vipMap, setVipMap] = useState<Map<string, CustomerVipStatus>>(new Map());
  const [loadingVip, setLoadingVip] = useState(false);
  
  // Refs para controle de race conditions
  const fetchIdRef = useRef(0);
  const lastPhonesRef = useRef<string>('');

  // Extrair phones únicos das reservas
  const uniquePhones = useMemo(() => {
    const phones = new Set<string>();
    reservationData.reservations.forEach(r => {
      if (r.phone && r.phone !== '—') {
        phones.add(r.phone);
      }
    });
    return Array.from(phones);
  }, [reservationData.reservations]);

  // Buscar VIP status em batch apenas quando phones mudam
  useEffect(() => {
    const phonesKey = uniquePhones.sort().join(',');
    
    // Se phones não mudaram, não refazer a busca
    if (phonesKey === lastPhonesRef.current || uniquePhones.length === 0) {
      return;
    }
    
    lastPhonesRef.current = phonesKey;
    const currentFetchId = ++fetchIdRef.current;

    // Verificar quais phones não estão no cache
    const uncachedPhones = uniquePhones.filter(phone => !vipCache.has(phone));
    
    // Se todos estão em cache, usar cache
    if (uncachedPhones.length === 0) {
      const cachedMap = new Map<string, CustomerVipStatus>();
      uniquePhones.forEach(phone => {
        const cached = vipCache.get(phone);
        if (cached) cachedMap.set(phone, cached);
      });
      setVipMap(cachedMap);
      return;
    }

    const fetchVipStatus = async () => {
      setLoadingVip(true);
      
      try {
        // Buscar em batch todos os phones não cacheados
        const { data: customers, error } = await supabase
          .from('customers')
          .select('phone, vip_status, queue_completed, reservations_completed, total_visits')
          .in('phone', uncachedPhones);

        if (error) throw error;
        
        // Verificar se ainda é a requisição mais recente
        if (currentFetchId !== fetchIdRef.current) return;

        // Processar resultados e atualizar cache
        const newVipMap = new Map<string, CustomerVipStatus>();
        
        // Primeiro, adicionar phones sem dados (não VIP)
        uncachedPhones.forEach(phone => {
          const defaultStatus: CustomerVipStatus = {
            isVip: false,
            queueCompleted: 0,
            reservationsCompleted: 0,
            totalVisitsCompleted: 0,
          };
          vipCache.set(phone, defaultStatus);
          newVipMap.set(phone, defaultStatus);
        });

        // Depois, sobrescrever com dados reais
        customers?.forEach(customer => {
          if (!customer.phone) return;
          
          const queueCompleted = customer.queue_completed || 0;
          const reservationsCompleted = customer.reservations_completed || 0;
          const totalVisitsCompleted = customer.total_visits || 0;
          const isVip = customer.vip_status || totalVisitsCompleted >= 10;

          const status: CustomerVipStatus = {
            isVip,
            queueCompleted,
            reservationsCompleted,
            totalVisitsCompleted,
          };
          
          vipCache.set(customer.phone, status);
          newVipMap.set(customer.phone, status);
        });

        // Adicionar phones já cacheados
        uniquePhones.forEach(phone => {
          if (!newVipMap.has(phone)) {
            const cached = vipCache.get(phone);
            if (cached) newVipMap.set(phone, cached);
          }
        });

        setVipMap(newVipMap);
      } catch (error) {
        console.error('Erro ao buscar status VIP:', error);
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoadingVip(false);
        }
      }
    };

    fetchVipStatus();
  }, [uniquePhones]);

  // Combinar reservas com VIP status de forma estável
  const enhancedReservations = useMemo((): ReservationEnhanced[] => {
    return reservationData.reservations.map(reservation => ({
      ...reservation,
      vipStatus: reservation.phone ? vipMap.get(reservation.phone) : undefined,
    }));
  }, [reservationData.reservations, vipMap]);

  return {
    ...reservationData,
    reservations: enhancedReservations,
    loadingVip,
  };
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { useReservations, Reservation } from './useReservations';
import { getCustomerVipStatus, CustomerVipStatus } from '@/utils/customerUtils';

/**
 * Hook aprimorado que adiciona informações VIP aos clientes das reservas
 * Utiliza padrão Ref-first para estabilidade de hooks
 */

export type ReservationEnhanced = Reservation & {
  vipStatus?: CustomerVipStatus;
};

export function useReservationsEnhanced() {
  // Hook calls sempre na mesma ordem, sem condicionais
  const [enhancedReservations, setEnhancedReservations] = useState<ReservationEnhanced[]>([]);
  const [loadingVip, setLoadingVip] = useState(false);
  
  // Chamar useReservations depois dos useState locais para consistência
  const reservationData = useReservations();
  
  // Ref para evitar race conditions e garantir estabilidade
  const isMountedRef = useRef(true);
  const processingRef = useRef(false);

  // Callback estabilizado para processar reservas
  const enhanceReservations = useCallback(async (reservations: Reservation[]) => {
    if (processingRef.current || reservations.length === 0) {
      if (reservations.length === 0) {
        setEnhancedReservations([]);
      }
      return;
    }

    processingRef.current = true;
    setLoadingVip(true);

    try {
      const enhanced = await Promise.all(
        reservations.map(async (reservation) => {
          try {
            const vipStatus = await getCustomerVipStatus(reservation.phone);
            return {
              ...reservation,
              vipStatus,
            };
          } catch {
            return { ...reservation, vipStatus: undefined };
          }
        })
      );

      if (isMountedRef.current) {
        setEnhancedReservations(enhanced);
      }
    } catch (error) {
      console.error('Erro ao calcular status VIP:', error);
      if (isMountedRef.current) {
        setEnhancedReservations(reservations.map(r => ({ ...r, vipStatus: undefined })));
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingVip(false);
      }
      processingRef.current = false;
    }
  }, []);

  // Effect para processar reservas quando mudam
  useEffect(() => {
    isMountedRef.current = true;
    
    enhanceReservations(reservationData.reservations);

    return () => {
      isMountedRef.current = false;
    };
  }, [reservationData.reservations, enhanceReservations]);

  // Retornar tipo explícito para garantir que TypeScript reconheça vipStatus
  const result: Omit<ReturnType<typeof useReservations>, 'reservations'> & { 
    reservations: ReservationEnhanced[];
    loadingVip: boolean;
  } = {
    ...reservationData,
    reservations: enhancedReservations.length > 0 
      ? enhancedReservations 
      : reservationData.reservations.map(r => ({ ...r, vipStatus: undefined })),
    loadingVip,
  };

  return result;
}

import { useEffect, useState } from 'react';
import { useReservations, Reservation } from './useReservations';
import { getCustomerVipStatus, CustomerVipStatus } from '@/utils/customerUtils';

/**
 * Hook aprimorado que adiciona informações VIP aos clientes das reservas
 */

type ReservationEnhanced = Reservation & {
  vipStatus?: CustomerVipStatus;
};

export function useReservationsEnhanced() {
  const reservationData = useReservations();
  const [enhancedReservations, setEnhancedReservations] = useState<ReservationEnhanced[]>([]);
  const [loadingVip, setLoadingVip] = useState(false);

  useEffect(() => {
    if (reservationData.reservations.length === 0) {
      setEnhancedReservations([]);
      return;
    }

    const enhanceReservations = async () => {
      setLoadingVip(true);
      try {
        const enhanced = await Promise.all(
          reservationData.reservations.map(async (reservation) => {
            const vipStatus = await getCustomerVipStatus(reservation.phone);
            return {
              ...reservation,
              vipStatus,
            };
          })
        );
        setEnhancedReservations(enhanced);
      } catch (error) {
        console.error('Erro ao calcular status VIP:', error);
        // Fallback: retornar sem dados VIP
        setEnhancedReservations(reservationData.reservations.map(r => ({ ...r, vipStatus: undefined })));
      } finally {
        setLoadingVip(false);
      }
    };

    enhanceReservations();
  }, [reservationData.reservations]);

  return {
    ...reservationData,
    reservations: enhancedReservations,
    loadingVip,
  };
}

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useReservationsRealtime } from './useReservationsRealtime';
import { RESTAURANT_ID } from '@/config/current-restaurant';

type Reservation = {
  reservation_id: string;
  restaurant_id: string;
  customer_name: string;
  phone: string;
  people: number;
  starts_at: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show';
  notes?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};

type DbReservation = {
  id: string;
  restaurant_id: string;
  user_id: string;
  name: string;
  phone: string;
  party_size: number;
  reserved_for: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show';
  notes?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};

export function useReservations() {
  const restaurantId = RESTAURANT_ID;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[useReservations] Buscando reservas...');
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('v_reservations')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('starts_at', { ascending: true });

      if (error) throw error;
      console.log('[useReservations] Reservas carregadas:', data?.length);
      setReservations(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar reservas';
      setError(message);
      console.error('[useReservations] Erro:', err);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  useReservationsRealtime(fetchReservations);

  const createReservation = async (reservation: { customer_name: string; phone: string; people: number; starts_at: string; notes?: string }) => {
    try {
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .insert([
          {
            name: reservation.customer_name,
            phone: reservation.phone,
            party_size: reservation.people,
            reserved_for: reservation.starts_at,
            notes: reservation.notes,
            restaurant_id: restaurantId,
            user_id: restaurantId, // Using restaurant ID as user_id for admin panel
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Enviar SMS com link da reserva
      try {
        const { sendSms, SMS_TEMPLATES } = await import('@/utils/sms');
        const reservationUrl = `${window.location.origin}/reserva/final?code=${data.id}`;
        const dateTime = new Date(reservation.starts_at).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const message = `Olá ${reservation.customer_name}! Sua reserva para ${dateTime} foi criada. Acompanhe: ${reservationUrl}`;
        await sendSms(reservation.phone, message);
        console.log('SMS enviado com sucesso para reserva:', data.id);
      } catch (smsError) {
        console.warn('Erro ao enviar SMS (não crítico):', smsError);
      }

      toast({
        title: 'Sucesso',
        description: 'Reserva criada com sucesso',
      });

      await fetchReservations();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar reserva';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateReservationStatus = async (reservationId: string, status: Reservation['status'], cancelReason?: string) => {
    try {
      console.log('[useReservations] Atualizando status:', { reservationId, status, cancelReason });
      const updateData: any = { status };
      
      // Add timestamp fields based on status
      if (status === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (status === 'canceled') {
        updateData.canceled_at = new Date().toISOString();
        updateData.canceled_by = 'admin';
        if (cancelReason) {
          updateData.cancel_reason = cancelReason;
        }
      } else if (status === 'no_show') {
        updateData.no_show_at = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .select();

      if (error) throw error;
      console.log('[useReservations] Status atualizado:', data);

      toast({
        title: 'Sucesso',
        description: 'Status atualizado com sucesso',
      });

      await fetchReservations();
      console.log('[useReservations] Reservas recarregadas após update');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
      console.error('[useReservations] Erro ao atualizar:', err);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  return {
    reservations,
    loading,
    error,
    refetch: fetchReservations,
    createReservation,
    updateReservationStatus,
  };
}

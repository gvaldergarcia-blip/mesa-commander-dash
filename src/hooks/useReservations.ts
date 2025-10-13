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
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('v_reservations')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('starts_at', { ascending: true });

      if (error) throw error;
      setReservations(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar reservas';
      setError(message);
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

  const updateReservationStatus = async (reservationId: string, status: Reservation['status']) => {
    try {
      const updateData: any = { status };
      
      // Add timestamp fields based on status
      if (status === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (status === 'canceled') {
        updateData.canceled_at = new Date().toISOString();
        updateData.canceled_by = 'admin';
      } else if (status === 'no_show') {
        updateData.no_show_at = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Status atualizado com sucesso',
      });

      await fetchReservations();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
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

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Reservation = {
  id: string;
  restaurant_id: string;
  customer_id?: string;
  customer_name: string;
  phone: string;
  party_size: number;
  reservation_datetime: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled';
  notes?: string;
  canceled_at?: string;
  canceled_by?: string;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
};

export function useReservations(restaurantId?: string) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (restaurantId) {
      fetchReservations();
    }
  }, [restaurantId]);

  const fetchReservations = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('reservation_datetime', { ascending: true });

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
  };

  const createReservation = async (reservation: Omit<Reservation, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .insert([reservation])
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

  const updateReservationStatus = async (id: string, status: Reservation['status']) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status })
        .eq('id', id);

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

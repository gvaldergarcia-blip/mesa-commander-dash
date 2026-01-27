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
  customer_email?: string;
  people: number;
  starts_at: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show';
  notes?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};

export type { Reservation };

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

  const createReservation = async (reservation: { customer_name: string; customer_email: string; people: number; starts_at: string; notes?: string }) => {
    try {
      // IMPORTANTE: criação via RPC (SECURITY DEFINER) para evitar bloqueio por RLS,
      // seguindo o mesmo padrão usado na Fila.
      const { data, error } = await supabase.rpc('create_reservation_panel', {
        p_restaurant_id: restaurantId,
        p_name: reservation.customer_name,
        p_customer_email: reservation.customer_email,
        p_reserved_for: reservation.starts_at,
        p_party_size: reservation.people,
        p_notes: reservation.notes ?? null,
      });

      if (error) throw error;
      if (!data) throw new Error('Reserva não retornou dados');

      // Buscar informações do restaurante para o email
      const { data: restaurantData } = await supabase
        .schema('mesaclik')
        .from('restaurants')
        .select('name, address, cuisine')
        .eq('id', restaurantId)
        .single();

      // Enviar e-mail de confirmação via Resend
      try {
        const reservationUrl = `${window.location.origin}/reserva/final?id=${(data as any).id}`;
        const dateTime = new Date(reservation.starts_at);
        const formattedDate = dateTime.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
        const formattedTime = dateTime.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });

        await supabase.functions.invoke('send-reservation-email', {
          body: {
            email: reservation.customer_email,
            customer_name: reservation.customer_name,
            restaurant_name: restaurantData?.name || 'Restaurante',
            restaurant_address: restaurantData?.address || null,
            restaurant_cuisine: restaurantData?.cuisine || null,
            reservation_date: formattedDate,
            reservation_time: formattedTime,
            party_size: reservation.people,
            notes: reservation.notes || null,
            reservation_url: reservationUrl,
            type: 'confirmation'
          }
        });
        console.log('E-mail de confirmação enviado para reserva:', (data as any).id);
      } catch (emailError) {
        console.warn('Erro ao enviar e-mail (não crítico):', emailError);
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

      // IMPORTANTE: Evitar SELECT direto em mesaclik.reservations aqui.
      // Em alguns ambientes/roles (ex: anon no painel), o SELECT pode retornar 0 linhas por RLS,
      // causando PGRST116 ao usar `.single()`. Como a tela já carrega via view `mesaclik.v_reservations`,
      // reaproveitamos os dados já em memória.
      const reservationFromState = reservations.find((r) => r.reservation_id === reservationId);
      const reservationData = reservationFromState
        ? { name: reservationFromState.customer_name, phone: reservationFromState.phone }
        : null;

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

      console.log('[useReservations] Update data:', updateData);
      console.log('[useReservations] Reservation ID:', reservationId);

      const { data, error } = await supabase
        .schema('mesaclik')
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .select();

      if (error) {
        console.error('[useReservations] Erro no update:', error);
        throw error;
      }
      
      console.log('[useReservations] Status atualizado com sucesso:', data);

      // Se status for 'completed', registrar/atualizar em customers
      if (status === 'completed' && reservationData) {
        await upsertCustomer({
          name: reservationData.name,
          phone: reservationData.phone,
          source: 'reservation'
        });
      } else if (status === 'completed' && !reservationData) {
        console.warn('[useReservations] Não encontrei dados da reserva no estado para registrar cliente:', reservationId);
      }

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

  // Função auxiliar para upsert de clientes
  const upsertCustomer = async (data: { name: string; phone?: string | null; email?: string; source: 'queue' | 'reservation' }) => {
    try {
      // Se não tiver phone nem nome, não criar cliente
      if (!data.name) {
        console.warn('[upsertCustomer] Nome não informado, ignorando criação de cliente');
        return;
      }

      const now = new Date().toISOString();
      let existingCustomer = null;

      // Buscar cliente existente - prioriza phone, mas se não tiver, busca por nome
      if (data.phone) {
        const { data: customerByPhone, error: searchError } = await supabase
          .from('customers')
          .select('*')
          .eq('phone', data.phone)
          .maybeSingle();

        if (searchError) throw searchError;
        existingCustomer = customerByPhone;
      }

      // Se não encontrou por phone, tenta por nome (fallback)
      if (!existingCustomer) {
        const { data: customerByName, error: searchByNameError } = await supabase
          .from('customers')
          .select('*')
          .eq('name', data.name)
          .maybeSingle();

        if (searchByNameError) throw searchByNameError;
        existingCustomer = customerByName;
      }

      if (existingCustomer) {
        // Atualizar cliente existente
        const updates: any = {
          last_visit_date: now,
          updated_at: now
        };

        if (data.source === 'queue') {
          updates.queue_completed = (existingCustomer.queue_completed || 0) + 1;
        } else {
          updates.reservations_completed = (existingCustomer.reservations_completed || 0) + 1;
        }

        // Calcular total de visitas e status VIP
        const totalVisits = (updates.queue_completed || existingCustomer.queue_completed || 0) + 
                           (updates.reservations_completed || existingCustomer.reservations_completed || 0);
        updates.total_visits = totalVisits;
        updates.vip_status = totalVisits >= 10;

        // Atualizar first_visit_at se estiver vazio
        if (!existingCustomer.first_visit_at) {
          updates.first_visit_at = now;
        }

        // Atualizar phone se estava vazio e agora temos
        if (!existingCustomer.phone && data.phone) {
          updates.phone = data.phone;
        }

        const { error: updateError } = await supabase
          .from('customers')
          .update(updates)
          .eq('id', existingCustomer.id);

        if (updateError) throw updateError;
        console.log('[upsertCustomer] Cliente atualizado:', existingCustomer.id);
      } else {
        // Criar novo cliente
        const newCustomer: any = {
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          queue_completed: data.source === 'queue' ? 1 : 0,
          reservations_completed: data.source === 'reservation' ? 1 : 0,
          total_visits: 1,
          vip_status: false,
          first_visit_at: now,
          last_visit_date: now
        };

        const { data: insertedCustomer, error: insertError } = await supabase
          .from('customers')
          .insert([newCustomer])
          .select()
          .single();

        if (insertError) throw insertError;
        console.log('[upsertCustomer] Novo cliente criado:', insertedCustomer?.id);
      }
    } catch (error) {
      console.error('[upsertCustomer] Erro ao registrar cliente:', error);
      // Não lançar erro para não bloquear a operação principal
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

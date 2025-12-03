import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueueRealtime } from './useQueueRealtime';
import { RESTAURANT_ID } from '@/config/current-restaurant';

type QueueEntry = {
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
};

export type { QueueEntry };

export function useQueue() {
  const restaurantId = RESTAURANT_ID;
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      
      // Buscar todas as entradas da fila (incluindo sentados e cancelados) das últimas 24h
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);
      
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('v_queue_current')
        .select('*')
        .gte('created_at', last24Hours.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      setQueueEntries(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar fila';
      setError(message);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useQueueRealtime(fetchQueue);

  const addToQueue = async (entry: { customer_name: string; phone: string; people: number; notes?: string }) => {
    try {
      // Buscar fila do restaurante
      const { data: activeQueue, error: queueError } = await supabase
        .schema('mesaclik')
        .from('queues')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .limit(1)
        .maybeSingle();

      if (queueError) throw queueError;
      if (!activeQueue) {
        throw new Error('Nenhuma fila encontrada para este restaurante');
      }

      // Inserir direto na tabela
      // Usar UUID zerado para clientes adicionados manualmente pelo restaurante
      const manualUserId = '00000000-0000-0000-0000-000000000000';
      
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .insert([
          {
            restaurant_id: restaurantId,
            queue_id: activeQueue.id,
            user_id: manualUserId,
            name: entry.customer_name,
            phone: entry.phone,
            party_size: entry.people,
            notes: entry.notes,
            status: 'waiting',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Enviar SMS com link da fila
      try {
        const { sendSms } = await import('@/utils/sms');
        const queueUrl = `${window.location.origin}/fila/final?ticket=${data.id}`;
        const message = `Olá ${entry.customer_name}! Você entrou na fila. Acompanhe sua posição: ${queueUrl}`;
        await sendSms(entry.phone, message);
        console.log('SMS enviado com sucesso para fila:', data.id);
      } catch (smsError) {
        console.warn('Erro ao enviar SMS (não crítico):', smsError);
      }

      toast({
        title: 'Sucesso',
        description: 'Cliente adicionado à fila',
      });

      await fetchQueue();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar à fila';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateQueueStatus = async (entryId: string, status: QueueEntry['status']) => {
    try {
      // Buscar dados do cliente antes de atualizar
      const { data: entryData, error: fetchError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('name, phone, email')
        .eq('id', entryId)
        .single();

      if (fetchError) throw fetchError;

      // Preparar dados de atualização
      const updateData: any = {
        status: status,
        updated_at: new Date().toISOString()
      };

      // Adicionar timestamps específicos por status
      if (status === 'called') {
        updateData.called_at = new Date().toISOString();
      } else if (status === 'seated') {
        updateData.seated_at = new Date().toISOString();
      } else if (status === 'canceled' || status === 'no_show') {
        updateData.canceled_at = new Date().toISOString();
      }

      // Atualizar diretamente na tabela
      const { error } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .update(updateData)
        .eq('id', entryId);

      if (error) throw error;

      // Se status for 'seated', registrar/atualizar em customers
      if (status === 'seated' && entryData) {
        await upsertCustomer({
          name: entryData.name,
          phone: entryData.phone,
          email: entryData.email,
          source: 'queue'
        });
      }

      const statusMessages: Record<QueueEntry['status'], string> = {
        'waiting': 'Status atualizado',
        'called': 'Cliente chamado',
        'seated': 'Cliente sentado',
        'canceled': 'Cliente cancelado',
        'no_show': 'Marcado como ausente',
      };

      toast({
        title: 'Sucesso',
        description: statusMessages[status],
      });

      await fetchQueue();
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

  // Função auxiliar para upsert de clientes
  const upsertCustomer = async (data: { name: string; phone: string; email?: string; source: 'queue' | 'reservation' }) => {
    try {
      // Buscar cliente existente pelo telefone
      const { data: existingCustomer, error: searchError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', data.phone)
        .maybeSingle();

      if (searchError) throw searchError;

      const now = new Date().toISOString();

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

        const { error: updateError } = await supabase
          .from('customers')
          .update(updates)
          .eq('id', existingCustomer.id);

        if (updateError) throw updateError;
      } else {
        // Criar novo cliente
        const newCustomer: any = {
          name: data.name,
          phone: data.phone,
          email: data.email,
          queue_completed: data.source === 'queue' ? 1 : 0,
          reservations_completed: data.source === 'reservation' ? 1 : 0,
          total_visits: 1,
          vip_status: false,
          first_visit_at: now,
          last_visit_date: now
        };

        const { error: insertError } = await supabase
          .from('customers')
          .insert([newCustomer]);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Erro ao registrar cliente:', error);
      // Não lançar erro para não bloquear a operação principal
    }
  };

  return {
    queueEntries,
    loading,
    error,
    refetch: fetchQueue,
    addToQueue,
    updateQueueStatus,
  };
}

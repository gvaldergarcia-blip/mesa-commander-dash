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

export function useQueue() {
  const restaurantId = RESTAURANT_ID;
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      
      // Buscar entradas da fila usando a view - apenas status ativos
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('v_queue_current')
        .select('*')
        .in('status', ['waiting', 'called'])
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

      // Buscar próxima posição
      const { data: queueData } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('position_number')
        .eq('queue_id', activeQueue.id)
        .eq('status', 'waiting')
        .order('position_number', { ascending: false })
        .limit(1);

      const nextPosition = queueData && queueData.length > 0 
        ? (queueData[0].position_number || 0) + 1 
        : 1;

      const { data, error } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .insert([
          {
            customer_name: entry.customer_name,
            phone: entry.phone,
            party_size: entry.people,
            notes: entry.notes,
            queue_id: activeQueue.id,
            status: 'waiting',
            priority: 'normal',
            position_number: nextPosition,
          },
        ])
        .select()
        .single();

      if (error) throw error;

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
      // Usar RPC para atualizar status com cast correto do enum
      const { error } = await supabase.rpc('update_queue_entry_status', {
        p_entry_id: entryId,
        p_status: status
      });

      if (error) throw error;

      if (error) throw error;

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

  return {
    queueEntries,
    loading,
    error,
    refetch: fetchQueue,
    addToQueue,
    updateQueueStatus,
  };
}

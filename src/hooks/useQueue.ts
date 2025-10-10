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
      // Buscar fila ativa
      const { data: activeQueue, error: queueError } = await supabase
        .schema('mesaclik')
        .from('queues')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (queueError) throw queueError;
      if (!activeQueue) {
        throw new Error('Nenhuma fila ativa encontrada');
      }

      const { data, error } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .insert([
          {
            name: entry.customer_name,
            phone: entry.phone,
            party_size: entry.people,
            notes: entry.notes,
            queue_id: activeQueue.id,
            restaurant_id: restaurantId,
            status: 'waiting',
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

  const updateQueueStatus = async (id: string, status: QueueEntry['status']) => {
    try {
      const updateData: any = { status };
      
      if (status === 'called') {
        updateData.called_at = new Date().toISOString();
      } else if (status === 'seated') {
        updateData.seated_at = new Date().toISOString();
      } else if (status === 'canceled' || status === 'no_show') {
        updateData.canceled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Status atualizado com sucesso',
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

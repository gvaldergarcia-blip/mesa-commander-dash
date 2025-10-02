import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type QueueEntry = {
  id: string;
  queue_id: string;
  customer_id?: string;
  customer_name: string;
  phone: string;
  party_size: number;
  priority: 'normal' | 'high' | 'vip';
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show';
  position_number?: number;
  notes?: string;
  estimated_wait_time?: number;
  called_at?: string;
  seated_at?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};

export function useQueue(restaurantId?: string) {
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (restaurantId) {
      fetchQueue();
    }
  }, [restaurantId]);

  const fetchQueue = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      
      // Buscar a fila do restaurante
      const { data: queues, error: queueError } = await supabase
        .from('queues')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (queueError) throw queueError;

      // Buscar as entradas da fila
      const { data, error } = await supabase
        .from('queue_entries')
        .select('*')
        .eq('queue_id', queues.id)
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
  };

  const addToQueue = async (entry: Omit<QueueEntry, 'id' | 'created_at' | 'updated_at' | 'queue_id'>) => {
    if (!restaurantId) return;

    try {
      // Buscar a fila do restaurante
      const { data: queues, error: queueError } = await supabase
        .from('queues')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (queueError) throw queueError;

      const { data, error } = await supabase
        .from('queue_entries')
        .insert([{ ...entry, queue_id: queues.id }])
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
      } else if (status === 'canceled') {
        updateData.canceled_at = new Date().toISOString();
      }

      const { error } = await supabase
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

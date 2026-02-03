import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueueRealtime } from './useQueueRealtime';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { getSizeGroup, matchesSizeGroup, getSizeGroupLabel } from '@/utils/queueUtils';

type QueueEntry = {
  entry_id: string;
  queue_id: string;
  customer_name: string;
  phone: string;
  email?: string;
  people: number;
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show' | 'cleared';
  notes?: string;
  queue_position?: number;
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
      setError(null);
      
      // Usar RPC para buscar entradas (bypassa RLS com SECURITY DEFINER)
      const { data, error: fetchError } = await supabase
        .schema('mesaclik')
        .rpc('get_queue_entries', {
          p_restaurant_id: restaurantId,
          p_hours_back: 24
        });

      if (fetchError) throw fetchError;
      setQueueEntries(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar fila';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Show error toast via useEffect to avoid unstable callback references
  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useQueueRealtime(fetchQueue);

  const addToQueue = async (entry: { customer_name: string; email: string; people: number; notes?: string }) => {
    try {
      if (!restaurantId) {
        throw new Error('Restaurant ID não configurado');
      }
      
      // Buscar fila do restaurante usando RPC para garantir acesso
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

      console.log('Adicionando à fila:', { restaurantId, queueId: activeQueue.id, entry });
      
      // Usar RPC para adicionar à fila (bypassa RLS com SECURITY DEFINER)
      const { data: rpcResult, error: rpcError } = await supabase
        .schema('mesaclik')
        .rpc('add_customer_to_queue', {
          p_restaurant_id: restaurantId,
          p_queue_id: activeQueue.id,
          p_customer_name: entry.customer_name,
          p_customer_email: entry.email || null,
          p_party_size: entry.people,
          p_notes: entry.notes || null,
        });
      
      if (rpcError) {
        console.error('Erro RPC add_customer_to_queue:', rpcError);
        throw rpcError;
      }

      
      const result = rpcResult as { success: boolean; entry_id?: string; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao adicionar à fila');
      }

      const data = { id: result.entry_id };

      // Calcular posição na fila por GRUPO (filas paralelas)
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);
      const sizeGroup = getSizeGroup(entry.people);
      
      const { data: waitingEntries } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('id, created_at, party_size')
        .eq('queue_id', activeQueue.id)
        .eq('status', 'waiting')
        .gte('created_at', last24Hours.toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      
      // Filtrar apenas entradas do MESMO grupo de tamanho
      const sameGroupEntries = (waitingEntries || []).filter(e => 
        matchesSizeGroup(e.party_size, sizeGroup)
      );
      
      // Posição = total de entradas no grupo (a nova é a última)
      const position = sameGroupEntries.length;

      // Buscar nome do restaurante
      const { data: restaurantData } = await supabase
        .schema('mesaclik')
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .maybeSingle();

      const restaurantName = restaurantData?.name || 'Restaurante';

      // Enviar email com link da fila (via edge function)
      try {
        const queueUrl = `${window.location.origin}/fila/final?ticket=${data.id}`;
        console.log('Enviando email para:', entry.email, 'com link:', queueUrl, 'grupo:', getSizeGroupLabel(sizeGroup));
        
        const { error: emailError } = await supabase.functions.invoke('send-queue-email', {
          body: {
            email: entry.email,
            customer_name: entry.customer_name,
            restaurant_name: restaurantName,
            position: position,
            party_size: entry.people,
            size_group: getSizeGroupLabel(sizeGroup),
            type: 'entry',
            queue_url: queueUrl,
          },
        });

        if (emailError) {
          console.warn('Erro ao enviar email (não crítico):', emailError);
        } else {
          console.log('Email de posição na fila enviado com sucesso');
        }
      } catch (emailError) {
        console.warn('Erro ao enviar email (não crítico):', emailError);
      }

      toast({
        title: 'Sucesso',
        description: 'Cliente adicionado à fila. Email enviado!',
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
      // Usar RPC que bypassa RLS e retorna dados necessários para notificações
      const { data: rpcResult, error: rpcError } = await supabase
        .schema('mesaclik')
        .rpc('update_queue_entry_status_v2', {
          p_entry_id: entryId,
          p_status: status
        });

      if (rpcError) throw rpcError;

      // Verificar se a atualização foi bem-sucedida
      const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
      
      if (!result || !result.success) {
        throw new Error('Entrada da fila não encontrada');
      }

      // Extrair dados do resultado
      const entryData = {
        name: result.customer_name,
        phone: result.phone,
        email: result.email,
        queue_id: result.queue_id,
        party_size: result.party_size
      };

      const queueId = entryData?.queue_id as string | undefined;

      // BROADCAST para clientes atualizarem posição em tempo real (sem polling!)
      if (queueId) {
        try {
          const channelName = `queue-broadcast-${queueId}`;
          console.log('📢 Disparando broadcast para:', channelName);
          
          const channel = supabase.channel(channelName);
          await channel.send({
            type: 'broadcast',
            event: 'queue_updated',
            payload: { status, entry_id: entryId, party_size: entryData.party_size }
          });
          // Remover canal após enviar
          supabase.removeChannel(channel);
        } catch (broadcastErr) {
          console.warn('Broadcast não enviado (não crítico):', broadcastErr);
        }
      }

      // NOTA: Removido o envio de emails de atualização (notify-queue-position-updates)
      // Agora a atualização de posição é feita via Realtime Broadcast na tela /fila/final
      // Isso evita spam de emails toda vez que alguém é atendido/cancelado

      // NOTA: O upsert de clientes agora é feito automaticamente pelo trigger
      // 'upsert_customer_on_queue_seated' no banco de dados (SECURITY DEFINER)
      // Isso resolve o erro de RLS ao inserir em customers

      const statusMessages: Record<QueueEntry['status'], string> = {
        'waiting': 'Status atualizado',
        'called': 'Cliente chamado',
        'seated': 'Cliente sentado',
        'canceled': 'Cliente cancelado',
        'no_show': 'Marcado como ausente',
        'cleared': 'Fila limpa',
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
  // NOTA: A função upsertCustomer foi removida - agora é tratada pelo trigger
  // 'upsert_customer_on_queue_seated' no banco de dados com SECURITY DEFINER

  const clearQueue = async (): Promise<{ success: boolean; entries_affected: number }> => {
    try {
      const { data, error: rpcError } = await supabase
        .rpc('clear_queue', { p_restaurant_id: restaurantId });

      if (rpcError) throw rpcError;

      const result = data as { success: boolean; error?: string; entries_affected?: number; message?: string };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao limpar fila');
      }

      toast({
        title: 'Fila limpa',
        description: `${result.entries_affected || 0} entradas foram removidas da fila.`,
      });

      await fetchQueue();

      return { success: true, entries_affected: result.entries_affected || 0 };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao limpar fila';
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
    clearQueue,
  };
}

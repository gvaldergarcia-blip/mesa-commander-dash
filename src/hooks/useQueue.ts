import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueueRealtime } from './useQueueRealtime';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { getSizeGroup, getSizeGroupLabel } from '@/utils/queueUtils';

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
  queue_type?: string;
};

export type { QueueEntry };

export function useQueue() {
  const { restaurantId } = useRestaurant();
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchQueue = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
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

  const addToQueue = async (entry: { customer_name: string; phone: string; email?: string; people: number; notes?: string; queue_type?: string }) => {
    try {
      if (!restaurantId) {
        throw new Error('Restaurant ID não configurado');
      }
      
      // Buscar fila do restaurante pelo tipo
      const targetType = entry.queue_type || 'normal';
      const { data: allQueues, error: queueError } = await supabase
        .schema('mesaclik')
        .from('queues')
        .select('id, queue_type')
        .eq('restaurant_id', restaurantId);

      if (queueError) throw queueError;
      
      let activeQueue = (allQueues || []).find(q => q.queue_type === targetType);
      
      // Se não encontrou a fila exclusiva, criar automaticamente
      if (!activeQueue && targetType === 'exclusive') {
        const { data: newQueue, error: createError } = await supabase
          .schema('mesaclik')
          .from('queues')
          .insert({ restaurant_id: restaurantId, queue_type: 'exclusive' })
          .select('id, queue_type')
          .single();
        if (createError) throw createError;
        activeQueue = newQueue;
      }
      
      // Fallback para fila normal
      if (!activeQueue) {
        activeQueue = (allQueues || []).find(q => q.queue_type === 'normal') || (allQueues || [])[0];
      }
      
      if (!activeQueue) {
        throw new Error('Nenhuma fila encontrada para este restaurante');
      }

      console.log('[useQueue] Adicionando à fila:', { restaurantId, queueId: activeQueue.id, entry });
      
      // Usar RPC para adicionar à fila (bypassa RLS com SECURITY DEFINER)
      const { data: rpcResult, error: rpcError } = await supabase
        .schema('mesaclik')
        .rpc('add_customer_to_queue', {
          p_restaurant_id: restaurantId,
          p_queue_id: activeQueue.id,
          p_customer_name: entry.customer_name,
          p_customer_phone: entry.phone.replace(/\D/g, ''),
          p_customer_email: entry.email || null,
          p_party_size: entry.people,
          p_notes: entry.notes || null,
        });
      
      if (rpcError) {
        console.error('[useQueue] Erro RPC add_customer_to_queue:', rpcError);
        throw rpcError;
      }

      const result = rpcResult as { success: boolean; entry_id?: string; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao adicionar à fila');
      }

      const data = { id: result.entry_id };

      // Buscar nome do restaurante para o email (mesmo padrão da reserva)
      const { data: restaurantData } = await supabase
        .schema('mesaclik')
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .maybeSingle();

      const restaurantName = restaurantData?.name || 'Restaurante';

      // Registrar cliente em restaurant_customers (phone é o identificador principal)
      try {
        await supabase.rpc('upsert_restaurant_customer', {
          p_restaurant_id: restaurantId,
          p_email: entry.email || `${entry.phone.replace(/\D/g, '')}@phone.local`,
          p_name: entry.customer_name,
          p_phone: entry.phone,
          p_source: 'queue',
          p_marketing_optin: null,
          p_terms_accepted: null,
        });
        console.log('[useQueue] Cliente registrado em restaurant_customers');
      } catch (customerError) {
        console.warn('[useQueue] Erro ao registrar cliente (não crítico):', customerError);
      }

      // Enviar SMS com link da fila
      try {
        const { getSiteBaseUrl } = await import('@/config/site-url');
        const queueUrl = `${getSiteBaseUrl()}/fila/final?ticket=${data.id}`;
        const sizeGroup = getSizeGroup(entry.people);

        console.log('[useQueue] Enviando SMS:', {
          phone: entry.phone,
          restaurant_name: restaurantName,
          type: 'entry',
          queue_url: queueUrl,
        });

        // Enviar SMS via Twilio
        const { toE164 } = await import('@/components/ui/phone-input');
        const { data: smsResponse, error: smsError } = await supabase.functions.invoke('send-sms', {
          body: {
            to: toE164(entry.phone),
            message: `${restaurantName}: Você entrou na fila! Acompanhe sua posição: ${queueUrl}`,
          },
        });

        if (smsError) {
          console.warn('[useQueue] Erro ao enviar SMS (não crítico):', smsError);
        } else {
          console.log('[useQueue] SMS de entrada na fila enviado com sucesso:', smsResponse);
        }

        // Também enviar email se fornecido
        if (entry.email) {
          const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-queue-email', {
            body: {
              email: entry.email,
              customer_name: entry.customer_name,
              restaurant_name: restaurantName,
              position: 0,
              party_size: entry.people,
              size_group: getSizeGroupLabel(sizeGroup),
              type: 'entry',
              queue_url: queueUrl,
            },
          });
          if (emailError) {
            console.warn('[useQueue] Erro ao enviar email (não crítico):', emailError);
          }
        }
      } catch (notifyError) {
        console.warn('[useQueue] Erro ao enviar notificações (não crítico):', notifyError);
      }

      toast({
        title: 'Sucesso',
        description: 'Cliente adicionado à fila. Notificação enviada!',
      });

      await fetchQueue();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar à fila';
      console.error('[useQueue] addToQueue error completo:', err);
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
      console.log('[useQueue] Atualizando status:', { entryId, status });

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

      // BROADCAST para clientes atualizarem posição em tempo real
      if (queueId) {
        try {
          const channelName = `queue-broadcast-${queueId}`;
          console.log('[useQueue] Disparando broadcast para:', channelName);
          
          const channel = supabase.channel(channelName);
          await channel.send({
            type: 'broadcast',
            event: 'queue_updated',
            payload: { status, entry_id: entryId, party_size: entryData.party_size }
          });
          supabase.removeChannel(channel);
        } catch (broadcastErr) {
          console.warn('[useQueue] Broadcast não enviado (não crítico):', broadcastErr);
        }
      }

      // Enviar email quando cliente é CHAMADO (mesmo padrão da reserva que envia em status changes)
      if (status === 'called' && entryData.email) {
        try {
          // Buscar nome do restaurante
          const { data: restaurantData } = await supabase
            .schema('mesaclik')
            .from('restaurants')
            .select('name')
            .eq('id', restaurantId)
            .maybeSingle();

          const restaurantName = restaurantData?.name || 'Restaurante';
          const { getSiteBaseUrl } = await import('@/config/site-url');
          const queueUrl = `${getSiteBaseUrl()}/fila/final?ticket=${entryId}`;

          console.log('[useQueue] Enviando email de chamada:', {
            email: entryData.email,
            restaurant_name: restaurantName,
            type: 'called',
          });

          const { data: emailResponse, error: emailError } = await supabase.functions.invoke('send-queue-email', {
            body: {
              email: entryData.email,
              customer_name: entryData.name,
              restaurant_name: restaurantName,
              position: 0,
              party_size: entryData.party_size,
              type: 'called',
              queue_url: queueUrl,
            },
          });

          if (emailError) {
            console.warn('[useQueue] Erro ao enviar email de chamada (não crítico):', emailError);
          } else {
            console.log('[useQueue] Email de chamada enviado com sucesso:', emailResponse);
          }
        } catch (emailError) {
          console.warn('[useQueue] Erro ao enviar email de chamada (não crítico):', emailError);
        }
      }

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

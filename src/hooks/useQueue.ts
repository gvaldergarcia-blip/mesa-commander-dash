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
      
      // Usar RPC para buscar entradas (bypassa RLS com SECURITY DEFINER)
      const { data, error } = await supabase
        .schema('mesaclik')
        .rpc('get_queue_entries', {
          p_restaurant_id: restaurantId,
          p_hours_back: 24
        });

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
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useQueueRealtime(fetchQueue);

  const addToQueue = async (entry: { customer_name: string; email: string; people: number; notes?: string }) => {
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

      if (rpcError) throw rpcError;
      
      const result = rpcResult as { success: boolean; entry_id?: string; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao adicionar à fila');
      }

      const data = { id: result.entry_id };

      // Calcular posição na fila por GRUPO (filas paralelas)
      // Cada tamanho de grupo (1-2, 3-4, 5-6, 7+) tem sua própria sequência
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

      // IMPORTANTE: e-mail NÃO “atualiza” sozinho (email é estático).
      // Para o cliente ver em tempo real, ele deve abrir o link /fila/final.
      // Mesmo assim, para atender o fluxo esperado (receber atualização por email),
      // disparamos um novo email do tipo 'position_update' para o grupo afetado.
      if (status !== 'waiting') {
        try {
          const baseUrl = window.location.origin;
          const partySize = Number(entryData?.party_size || 1);
          const queueId = entryData?.queue_id as string | undefined;

          if (queueId) {
            const { error: notifyError } = await supabase.functions.invoke(
              'notify-queue-position-updates',
              {
                body: {
                  restaurant_id: restaurantId,
                  queue_id: queueId,
                  party_size: partySize,
                  base_url: baseUrl,
                  exclude_entry_id: entryId,
                },
              }
            );

            if (notifyError) {
              console.warn('Falha ao enviar emails de atualização (não crítico):', notifyError);
            }
          }
        } catch (notifyErr) {
          console.warn('Falha ao enviar emails de atualização (não crítico):', notifyErr);
        }
      }

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
      // Buscar cliente existente pelo telefone e restaurante
      const { data: existingCustomer, error: searchError } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', data.phone)
        .eq('restaurant_id', restaurantId)
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
        // Criar novo cliente com restaurant_id para isolamento multi-tenant
        const newCustomer: any = {
          name: data.name,
          phone: data.phone,
          email: data.email,
          restaurant_id: restaurantId,
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

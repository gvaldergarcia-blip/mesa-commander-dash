/**
 * Página de acompanhamento em tempo real da fila
 * Mostra posição calculada por GRUPO (igual à tela comando)
 * Aceita: /fila/final?ticket=ID ou /fila/final?restauranteId=ID
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Users, Clock, XCircle, CheckCircle2, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface QueueInfo {
  ticket_id: string;
  restaurant_id: string;
  restaurant_name: string;
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show';
  position: number | null;
  party_size: number;
  created_at: string;
}

export default function FilaFinal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Aceitar tanto ticket quanto restauranteId
  const ticketId = searchParams.get('ticket');
  const restauranteIdParam = searchParams.get('restauranteId');

  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Buscar informações da fila por ticket_id
  const fetchQueueInfo = useCallback(async () => {
    if (!ticketId && !restauranteIdParam) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      let entryData: any = null;
      let restaurantId = restauranteIdParam;

      if (ticketId) {
        // Buscar entrada pelo ticket ID
        const { data: entry, error: entryError } = await supabase
          .schema('mesaclik')
          .from('queue_entries')
          .select('id, restaurant_id, status, party_size, created_at, name')
          .eq('id', ticketId)
          .maybeSingle();

        if (entryError || !entry) {
          console.error('Entrada não encontrada:', entryError);
          setNotFound(true);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        entryData = entry;
        restaurantId = entry.restaurant_id;
      }

      // Buscar nome do restaurante
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .maybeSingle();

      // Calcular posição por GRUPO (igual Tela Comando)
      // Contar quantos grupos estão aguardando ANTES deste ticket
      let position: number | null = null;
      
      if (entryData && entryData.status === 'waiting') {
        const { data: waitingEntries } = await supabase
          .schema('mesaclik')
          .from('queue_entries')
          .select('id, created_at')
          .eq('restaurant_id', restaurantId)
          .eq('status', 'waiting')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

        if (waitingEntries) {
          const index = waitingEntries.findIndex(e => e.id === ticketId);
          if (index !== -1) {
            position = index + 1; // 1-indexed
          }
        }
      }

      setQueueInfo({
        ticket_id: ticketId || '',
        restaurant_id: restaurantId || '',
        restaurant_name: restaurant?.name || 'Restaurante',
        status: entryData?.status || 'waiting',
        position,
        party_size: entryData?.party_size || 1,
        created_at: entryData?.created_at || new Date().toISOString(),
      });

      setNotFound(false);
    } catch (err) {
      console.error('Erro ao buscar info da fila:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ticketId, restauranteIdParam]);

  // Inicialização
  useEffect(() => {
    fetchQueueInfo();
  }, [fetchQueueInfo]);

  // Real-time subscription em mesaclik.queue_entries
  useEffect(() => {
    if (!queueInfo?.restaurant_id) return;

    console.log('Iniciando realtime para restaurant_id:', queueInfo.restaurant_id);

    // Subscrever para mudanças em tempo real na tabela CORRETA
    const channel = supabase
      .channel(`queue-realtime-${queueInfo.restaurant_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'queue_entries',
          filter: `restaurant_id=eq.${queueInfo.restaurant_id}`,
        },
        (payload) => {
          console.log('🔄 Fila atualizada em tempo real:', payload);
          // Recalcular posição quando qualquer entrada mudar
          fetchQueueInfo();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // Fallback polling a cada 10s (caso realtime falhe)
    const interval = setInterval(fetchQueueInfo, 10000);

    return () => {
      console.log('Removendo canal realtime');
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [queueInfo?.restaurant_id, fetchQueueInfo]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando sua posição...</p>
        </div>
      </div>
    );
  }

  // Não encontrado
  if (notFound || !queueInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Entrada não encontrada</CardTitle>
            <CardDescription>
              O link pode ter expirado ou a entrada foi cancelada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full"
              onClick={() => navigate('/')}
            >
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = {
    waiting: { 
      label: 'Aguardando', 
      variant: 'secondary' as const,
      icon: Clock,
      color: 'text-muted-foreground'
    },
    called: { 
      label: 'CHAMADO!', 
      variant: 'default' as const,
      icon: Bell,
      color: 'text-primary'
    },
    seated: { 
      label: 'Sentado', 
      variant: 'outline' as const,
      icon: CheckCircle2,
      color: 'text-green-600'
    },
    canceled: { 
      label: 'Cancelado', 
      variant: 'destructive' as const,
      icon: XCircle,
      color: 'text-destructive'
    },
    no_show: { 
      label: 'Ausente', 
      variant: 'destructive' as const,
      icon: XCircle,
      color: 'text-destructive'
    },
  };

  const config = statusConfig[queueInfo.status] || statusConfig.waiting;
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        {/* Header com gradiente laranja */}
        <CardHeader className="text-center space-y-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg pb-6">
          <div className="text-3xl mb-2">🎉</div>
          <CardTitle className="text-2xl font-bold text-white">Você está na fila!</CardTitle>
          <CardDescription className="text-white/90 text-base">
            {queueInfo.restaurant_name}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Status chamado */}
          {queueInfo.status === 'called' && (
            <div className="animate-pulse bg-orange-100 rounded-xl p-6 text-center border-2 border-orange-300">
              <p className="text-orange-600 font-bold text-2xl">
                🎉 É a sua vez!
              </p>
              <p className="text-sm text-orange-700 mt-2">
                Dirija-se ao balcão
              </p>
            </div>
          )}

          {/* Posição na fila - estilo igual ao email */}
          {queueInfo.status === 'waiting' && (
            <div className="bg-orange-50 rounded-xl p-6 text-center">
              <p className="text-orange-800 text-sm font-semibold uppercase tracking-wide mb-2">
                SUA POSIÇÃO
              </p>
              <p className="text-6xl font-extrabold text-orange-500">
                {queueInfo.position || '-'}º
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Posição calculada por grupo na fila
              </p>
            </div>
          )}

          {/* Info do grupo */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground bg-muted/50 rounded-lg py-3">
            <Users className="h-4 w-4" />
            <span className="font-medium">{queueInfo.party_size} {queueInfo.party_size === 1 ? 'pessoa' : 'pessoas'}</span>
          </div>

          {/* Badge de status para outros status */}
          {queueInfo.status !== 'waiting' && queueInfo.status !== 'called' && (
            <div className="flex justify-center">
              <Badge variant={config.variant} className="text-sm px-4 py-2">
                <StatusIcon className={`mr-2 h-4 w-4 ${config.color}`} />
                {config.label}
              </Badge>
            </div>
          )}

          {/* Indicador de tempo real */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Atualização em tempo real
          </div>

          {/* Botão atualizar manual */}
          <Button
            variant="outline"
            className="w-full"
            onClick={fetchQueueInfo}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar manualmente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
/**
 * Página de acompanhamento em tempo real da fila
 * Com consentimento LGPD obrigatório antes de ver posição
 * Mostra posição calculada por GRUPO (filas paralelas por tamanho)
 * Aceita: /fila/final?ticket=ID ou /fila/final?restauranteId=ID
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Clock, XCircle, CheckCircle2, Bell, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSizeGroup, getSizeGroupLabel } from '@/utils/queueUtils';
import { QueueConsentForm } from '@/components/queue/QueueConsentForm';
import { useQueueConsent } from '@/hooks/useQueueConsent';

interface QueueInfo {
  ticket_id: string;
  queue_id: string;
  restaurant_id: string;
  restaurant_name: string;
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show';
  position: number | null;
  party_size: number;
  size_group: string;
  created_at: string;
  customer_email?: string;
  customer_name?: string;
}

export default function FilaFinal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const realtimeSubscribedRef = useRef(false);
  
  // Aceitar tanto ticket quanto restauranteId
  const ticketId = searchParams.get('ticket');
  const restauranteIdParam = searchParams.get('restauranteId');

  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Estado de consentimento local (para UI responsiva)
  const [localTermsAccepted, setLocalTermsAccepted] = useState(false);
  const [localMarketingOptin, setLocalMarketingOptin] = useState(false);
  const [consentLoading, setConsentLoading] = useState(true);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  
  // Hook de consentimento
  const { 
    fetchConsents, 
    saveTermsConsent, 
    saveMarketingOptin,
    loading: consentHookLoading 
  } = useQueueConsent();

  // Atualizar título da aba do navegador
  useEffect(() => {
    document.title = 'MesaClik - Acompanhar Fila';
  }, []);

  // Buscar informações da fila por ticket_id
  const fetchQueueInfo = useCallback(async () => {
    if (!ticketId && !restauranteIdParam) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      // Importante: esta página é pública (link por e-mail), então não pode depender de SELECT direto
      // em mesaclik.queue_entries, pois o RLS pode bloquear e gerar "Entrada não encontrada".
      // A edge function usa SERVICE ROLE e retorna apenas o necessário para este ticket.
      const { data, error } = await supabase.functions.invoke('get-queue-info', {
        body: {
          ticket_id: ticketId,
          restaurant_id: restauranteIdParam,
        },
      });

      if (error) {
        console.error('Erro ao buscar info da fila (edge):', error);
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!data || data.found === false) {
        console.error('Entrada não encontrada (edge):', data);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const partySize = Number(data.party_size || 1);
      const sizeGroup = getSizeGroup(partySize);
      const position: number | null = typeof data.position === 'number' ? data.position : null;

      setQueueInfo({
        ticket_id: data.ticket_id || ticketId || '',
        queue_id: data.queue_id || '',
        restaurant_id: data.restaurant_id || restauranteIdParam || '',
        restaurant_name: data.restaurant_name || 'Restaurante',
        status: data.status || 'waiting',
        position,
        party_size: partySize,
        size_group: getSizeGroupLabel(sizeGroup),
        created_at: data.created_at || new Date().toISOString(),
        customer_email: data.customer_email,
        customer_name: data.customer_name,
      });

      setNotFound(false);
    } catch (err) {
      console.error('Erro ao buscar info da fila:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [ticketId, restauranteIdParam]);

  // Buscar consentimentos existentes quando tiver as infos da fila
  useEffect(() => {
    const loadConsents = async () => {
      if (!queueInfo?.restaurant_id || !queueInfo?.ticket_id || !queueInfo?.customer_email) {
        setConsentLoading(false);
        return;
      }

      setConsentLoading(true);
      const { termsAccepted, marketingOptin } = await fetchConsents(
        queueInfo.restaurant_id,
        queueInfo.ticket_id,
        queueInfo.customer_email
      );
      
      setLocalTermsAccepted(termsAccepted);
      setLocalMarketingOptin(marketingOptin);
      // Se já aceitou termos antes, já pode ver a posição
      setConsentConfirmed(termsAccepted);
      setConsentLoading(false);
    };

    if (queueInfo) {
      loadConsents();
    }
  }, [queueInfo?.restaurant_id, queueInfo?.ticket_id, queueInfo?.customer_email, fetchConsents]);

  // Handler para mudança no checkbox de termos (apenas UI, não salva ainda)
  const handleTermsChange = (accepted: boolean) => {
    setLocalTermsAccepted(accepted);
  };

  // Handler para mudança no checkbox de marketing (apenas UI, não salva ainda)
  const handleMarketingChange = (optin: boolean) => {
    setLocalMarketingOptin(optin);
  };

  // Handler para confirmar consentimento e ver posição
  const handleConfirmConsent = async () => {
    if (!queueInfo?.restaurant_id || !queueInfo?.ticket_id || !queueInfo?.customer_email) {
      return;
    }

    setSavingConsent(true);
    
    try {
      // Salvar termos aceitos E fazer upsert no CRM consolidado
      // Passando phone (se existir) e marketing optin para a função RPC
      await saveTermsConsent(
        queueInfo.restaurant_id,
        queueInfo.ticket_id,
        queueInfo.customer_email,
        queueInfo.customer_name,
        localTermsAccepted,
        undefined, // customerPhone - não temos no fluxo atual
        localMarketingOptin // Passa o marketing optin para o CRM
      );

      // Salvar marketing optin separado (tabela específica)
      if (localMarketingOptin) {
        await saveMarketingOptin(
          queueInfo.restaurant_id,
          queueInfo.customer_email,
          queueInfo.customer_name,
          localMarketingOptin
        );
      }

      // Liberar visualização da posição
      setConsentConfirmed(true);
    } catch (error) {
      console.error('Erro ao salvar consentimento:', error);
    } finally {
      setSavingConsent(false);
    }
  };

  // Inicialização
  useEffect(() => {
    fetchQueueInfo();
  }, [fetchQueueInfo]);

  // Real-time subscription em mesaclik.queue_entries
  // Usamos refs para não recriar o canal a cada mudança de queueInfo
  const queueIdRef = useRef<string | null>(null);
  const restaurantIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingRef = useRef<number | null>(null);

  // Atualizar refs quando queueInfo mudar
  useEffect(() => {
    if (queueInfo?.queue_id) queueIdRef.current = queueInfo.queue_id;
    if (queueInfo?.restaurant_id) restaurantIdRef.current = queueInfo.restaurant_id;
  }, [queueInfo?.queue_id, queueInfo?.restaurant_id]);

  useEffect(() => {
    // Precisamos de pelo menos queue_id para subscrever
    const queueId = queueInfo?.queue_id;
    if (!queueId) return;

    // Limpar canal anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    realtimeSubscribedRef.current = false;

    const channelName = `fila-cliente-${queueId}`;
    const filter = `queue_id=eq.${queueId}`;

    console.log('📡 Iniciando Realtime para cliente, filtro:', filter);

    // Subscrever para mudanças em tempo real
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'queue_entries',
          filter,
        },
        (payload) => {
          console.log('🔄 Fila atualizada em tempo real (cliente):', payload.eventType);
          // Recalcular posição quando qualquer entrada mudar
          fetchQueueInfo();
        }
      )
      .subscribe((status) => {
        console.log('Realtime status (cliente):', status);
        realtimeSubscribedRef.current = status === 'SUBSCRIBED';
      });

    channelRef.current = channel;

    // Polling de fallback - SEMPRE ativo a cada 5 segundos como segurança extra
    pollingRef.current = window.setInterval(() => {
      console.log('🔁 Polling de segurança (cliente)…');
      fetchQueueInfo();
    }, 5000);

    return () => {
      console.log('🔌 Removendo canal realtime (cliente)');
      realtimeSubscribedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [queueInfo?.queue_id, fetchQueueInfo]);

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

  // Se ainda não confirmou consentimento, mostrar tela de consentimento
  if (!consentConfirmed && !consentLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          {/* Header com gradiente laranja */}
          <CardHeader className="text-center space-y-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg pb-6">
            <ShieldCheck className="h-12 w-12 mx-auto mb-2" />
            <CardTitle className="text-2xl font-bold text-white">Quase lá!</CardTitle>
            <CardDescription className="text-white/90 text-base">
              {queueInfo.restaurant_name}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <p className="text-center text-muted-foreground">
              Para acompanhar sua posição na fila em tempo real, por favor aceite nossos termos.
            </p>

            {/* Formulário de consentimento */}
            <QueueConsentForm
              termsAccepted={localTermsAccepted}
              marketingOptin={localMarketingOptin}
              onTermsChange={handleTermsChange}
              onMarketingChange={handleMarketingChange}
              disabled={savingConsent}
              restaurantName={queueInfo.restaurant_name}
            />

            {/* Botão desabilitado até aceitar termos */}
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6"
              disabled={!localTermsAccepted || savingConsent}
              onClick={handleConfirmConsent}
            >
              {savingConsent ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                '📱 Ver minha posição em tempo real'
              )}
            </Button>

            {!localTermsAccepted && (
              <p className="text-center text-xs text-muted-foreground">
                Marque a caixa acima para continuar
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela principal com posição (termos aceitos)
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
                Fila de {queueInfo.size_group}
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

          {/* Badge de termos aceitos */}
          <div className="flex items-center justify-center gap-2 text-green-600 text-xs">
            <ShieldCheck className="h-3 w-3" />
            <span>Termos aceitos</span>
          </div>

          {/* Mensagem informativa */}
          <p className="text-center text-sm text-muted-foreground">
            Fique de olho! Avisaremos quando for a sua vez.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

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
  restaurant_logo_url?: string | null;
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show';
  position: number | null;
  party_size: number;
  size_group: string;
  created_at: string;
  customer_email?: string;
  customer_name?: string;
  tolerance_minutes?: number;
}

export default function FilaFinal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const realtimeSubscribedRef = useRef(false);
  const queueIdRef = useRef<string | null>(null);
  
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
        restaurant_logo_url: data.restaurant_logo_url || null,
        status: data.status || 'waiting',
        position,
        party_size: partySize,
        size_group: getSizeGroupLabel(sizeGroup),
        created_at: data.created_at || new Date().toISOString(),
        customer_email: data.customer_email,
        customer_name: data.customer_name,
        tolerance_minutes: data.tolerance_minutes ?? 10,
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

  // Real-time via Broadcast (não depende de RLS)
  // A Tela Comando dispara um broadcast quando atualiza status
  useEffect(() => {
    const queueId = queueInfo?.queue_id;
    if (!queueId) return;
    
    // Evitar re-inscrição se já está inscrito no mesmo canal
    if (queueIdRef.current === queueId && realtimeSubscribedRef.current) {
      return;
    }
    
    queueIdRef.current = queueId;
    realtimeSubscribedRef.current = false;

    // Canal de broadcast para esta fila específica
    const channelName = `queue-broadcast-${queueId}`;
    console.log('📡 Inscrevendo no broadcast:', channelName);

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'queue_updated' }, (payload) => {
        console.log('🔄 Broadcast recebido - atualizando posição:', payload);
        // Buscar posição atualizada via edge function
        supabase.functions.invoke('get-queue-info', {
          body: {
            ticket_id: ticketId,
            restaurant_id: restauranteIdParam,
          },
        }).then(({ data, error }) => {
          if (!error && data && data.found !== false) {
            const partySize = Number(data.party_size || 1);
            const sizeGroup = getSizeGroup(partySize);
            const position: number | null = typeof data.position === 'number' ? data.position : null;

            setQueueInfo(prev => prev ? {
              ...prev,
              status: data.status || prev.status,
              position,
              size_group: getSizeGroupLabel(sizeGroup),
              tolerance_minutes: data.tolerance_minutes ?? prev.tolerance_minutes,
            } : prev);
          }
        });
      })
      .subscribe((status) => {
        console.log('Broadcast status:', status);
        realtimeSubscribedRef.current = status === 'SUBSCRIBED';
      });

    return () => {
      console.log('🔌 Removendo canal broadcast');
      realtimeSubscribedRef.current = false;
      queueIdRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [queueInfo?.queue_id, ticketId, restauranteIdParam]);

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
          {/* Restaurant info with logo */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {queueInfo.restaurant_logo_url ? (
              <img 
                src={queueInfo.restaurant_logo_url} 
                alt={queueInfo.restaurant_name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                {queueInfo.restaurant_name.charAt(0)}
              </div>
            )}
            <CardDescription className="text-white/90 text-base">
              {queueInfo.restaurant_name}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Status chamado */}
          {queueInfo.status === 'called' && (
            <div className="animate-pulse bg-orange-100 rounded-xl p-6 text-center border-2 border-orange-300">
              <p className="text-orange-600 font-bold text-2xl">
                🎉 É a sua vez!
              </p>
              <p className="text-orange-700 font-medium mt-2">
                Dirija-se ao balcão.
              </p>
              <div className="mt-4 pt-4 border-t border-orange-200">
                <p className="text-sm text-orange-600 flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    <strong>Tolerância:</strong> o restaurante aguardará{' '}
                    <strong>{queueInfo.tolerance_minutes ?? 10} minutos</strong> antes de liberar a mesa.
                  </span>
                </p>
              </div>
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

          {/* MesaClik footer logo */}
          <div className="pt-4 border-t border-border/50 flex justify-center">
            <img 
              src="/images/mesaclik-logo.png" 
              alt="MesaClik" 
              className="h-8 opacity-60"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

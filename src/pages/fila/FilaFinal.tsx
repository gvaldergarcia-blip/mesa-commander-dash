/**
 * Página de acompanhamento em tempo real da fila
 * Modal de consentimento aparece sobre a posição borrada
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Users, Clock, XCircle, CheckCircle2, Bell, ShieldCheck, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSizeGroup, getSizeGroupLabel } from '@/utils/queueUtils';
import { resolveCustomerConsentEmail } from '@/utils/customerIdentifiers';

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
  customer_phone?: string;
  customer_name?: string;
  tolerance_minutes?: number;
}

export default function FilaFinal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const realtimeSubscribedRef = useRef(false);
  const queueIdRef = useRef<string | null>(null);
  
  const ticketId = searchParams.get('ticket');
  const restauranteIdParam = searchParams.get('restauranteId');

  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Consentimento via modal
  const [showModal, setShowModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptin, setMarketingOptin] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    document.title = 'MesaClik - Acompanhar Fila';
  }, []);

  const fetchQueueInfo = useCallback(async () => {
    if (!ticketId && !restauranteIdParam) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-queue-info', {
        body: { ticket_id: ticketId, restaurant_id: restauranteIdParam },
      });

      if (error || !data || data.found === false) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const partySize = Number(data.party_size || 1);
      const sizeGroup = getSizeGroup(partySize);

      const info: QueueInfo = {
        ticket_id: data.ticket_id || ticketId || '',
        queue_id: data.queue_id || '',
        restaurant_id: data.restaurant_id || restauranteIdParam || '',
        restaurant_name: data.restaurant_name || 'Restaurante',
        restaurant_logo_url: data.restaurant_logo_url || null,
        status: data.status || 'waiting',
        position: typeof data.position === 'number' ? data.position : null,
        party_size: partySize,
        size_group: getSizeGroupLabel(sizeGroup),
        created_at: data.created_at || new Date().toISOString(),
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        customer_name: data.customer_name,
        tolerance_minutes: data.tolerance_minutes ?? 10,
      };

      setQueueInfo(info);
      setNotFound(false);

      // Verificar se já aceitou termos anteriormente
      const email = resolveCustomerConsentEmail(info.customer_email, info.customer_phone);
      if (email && info.restaurant_id) {
        try {
          const { data: existing } = await supabase
            .from('queue_terms_consents')
            .select('terms_accepted')
            .eq('restaurant_id', info.restaurant_id)
            .eq('customer_email', email)
            .eq('terms_accepted', true)
            .limit(1)
            .maybeSingle();

          if (existing?.terms_accepted) {
            setConsentSaved(true);
          } else {
            setShowModal(true);
          }
        } catch {
          setShowModal(true);
        }
      } else {
        setShowModal(true);
      }
    } catch (err) {
      console.error('Erro ao buscar info da fila:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [ticketId, restauranteIdParam]);

  useEffect(() => {
    fetchQueueInfo();
  }, [fetchQueueInfo]);

  // Aceitar termos via modal
  const handleAcceptTerms = () => {
    // Fechar modal e animar reveal
    setShowModal(false);
    setRevealing(true);
    
    setTimeout(() => {
      setConsentSaved(true);
      setRevealing(false);
    }, 600);

    if (!queueInfo) return;
    const email = resolveCustomerConsentEmail(queueInfo.customer_email, queueInfo.customer_phone);
    if (!email) return;

    // Salvar em background
    void (async () => {
      try {
        // Salvar na tabela de termos
        await supabase.from('queue_terms_consents').upsert({
          restaurant_id: queueInfo.restaurant_id,
          ticket_id: queueInfo.ticket_id,
          customer_email: email,
          customer_name: queueInfo.customer_name || null,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_version: 'v1',
          privacy_version: 'v1',
        }, { onConflict: 'restaurant_id,ticket_id' });

        // Salvar no CRM
        let { error } = await supabase.rpc('upsert_restaurant_customer', {
          p_restaurant_id: queueInfo.restaurant_id,
          p_email: email,
          p_name: queueInfo.customer_name || null,
          p_phone: queueInfo.customer_phone || null,
          p_source: 'queue',
          p_marketing_optin: marketingOptin,
          p_terms_accepted: true,
        });
        if (error) console.warn('[FilaFinal] Consentimento CRM:', error);
      } catch (e) {
        console.error('[FilaFinal] Erro ao salvar consentimento:', e);
      }
    })();
  };

  // Broadcast realtime
  useEffect(() => {
    const queueId = queueInfo?.queue_id;
    if (!queueId) return;
    if (queueIdRef.current === queueId && realtimeSubscribedRef.current) return;
    
    queueIdRef.current = queueId;
    realtimeSubscribedRef.current = false;

    const channel = supabase
      .channel(`queue-broadcast-${queueId}`)
      .on('broadcast', { event: 'queue_updated' }, () => {
        supabase.functions.invoke('get-queue-info', {
          body: { ticket_id: ticketId, restaurant_id: restauranteIdParam },
        }).then(({ data, error }) => {
          if (!error && data && data.found !== false) {
            const partySize = Number(data.party_size || 1);
            const sizeGroup = getSizeGroup(partySize);
            setQueueInfo(prev => prev ? {
              ...prev,
              status: data.status || prev.status,
              position: typeof data.position === 'number' ? data.position : null,
              size_group: getSizeGroupLabel(sizeGroup),
              tolerance_minutes: data.tolerance_minutes ?? prev.tolerance_minutes,
            } : prev);
          }
        });
      })
      .subscribe((status) => {
        realtimeSubscribedRef.current = status === 'SUBSCRIBED';
      });

    return () => {
      realtimeSubscribedRef.current = false;
      queueIdRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [queueInfo?.queue_id, ticketId, restauranteIdParam]);

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

  if (notFound || !queueInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Entrada não encontrada</CardTitle>
            <CardDescription>O link pode ter expirado ou a entrada foi cancelada.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/')}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = {
    waiting: { label: 'Aguardando', variant: 'secondary' as const, icon: Clock, color: 'text-muted-foreground' },
    called: { label: 'CHAMADO!', variant: 'default' as const, icon: Bell, color: 'text-primary' },
    seated: { label: 'Sentado', variant: 'outline' as const, icon: CheckCircle2, color: 'text-green-600' },
    canceled: { label: 'Cancelado', variant: 'destructive' as const, icon: XCircle, color: 'text-destructive' },
    no_show: { label: 'Ausente', variant: 'destructive' as const, icon: XCircle, color: 'text-destructive' },
  };

  const config = statusConfig[queueInfo.status] || statusConfig.waiting;
  const StatusIcon = config.icon;
  const shouldBlur = !consentSaved && !revealing;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg pb-6">
          <div className="text-3xl mb-2">🎉</div>
          <CardTitle className="text-2xl font-bold text-white">Você está na fila!</CardTitle>
          <div className="flex items-center justify-center gap-2 pt-2">
            {queueInfo.restaurant_logo_url ? (
              <img src={queueInfo.restaurant_logo_url} alt={queueInfo.restaurant_name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                {queueInfo.restaurant_name.charAt(0)}
              </div>
            )}
            <CardDescription className="text-white/90 text-base">{queueInfo.restaurant_name}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className={`space-y-6 pt-6 transition-opacity duration-500 ${shouldBlur ? 'opacity-60' : 'opacity-100'}`}>
          {/* Status chamado */}
          {queueInfo.status === 'called' && consentSaved && (
            <div className="animate-pulse bg-orange-100 rounded-xl p-6 text-center border-2 border-orange-300">
              <p className="text-orange-600 font-bold text-2xl">🎉 É a sua vez!</p>
              <p className="text-orange-700 font-medium mt-2">Dirija-se ao balcão.</p>
              <div className="mt-4 pt-4 border-t border-orange-200">
                <p className="text-sm text-orange-600 flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span><strong>Tolerância:</strong> {queueInfo.tolerance_minutes ?? 10} minutos</span>
                </p>
              </div>
            </div>
          )}

          {/* Posição na fila - com blur condicional */}
          {(queueInfo.status === 'waiting' || !consentSaved) && (
            <div className={`bg-orange-50 rounded-xl p-6 text-center transition-all duration-700 ease-out ${shouldBlur ? 'blur-lg' : revealing ? 'blur-0' : ''}`}>
              <p className="text-orange-800 text-sm font-semibold uppercase tracking-wide mb-2">SUA POSIÇÃO</p>
              <p className="text-6xl font-extrabold text-orange-500">{queueInfo.position || '-'}º</p>
              <p className="text-xs text-muted-foreground mt-3">Fila de {queueInfo.size_group}</p>
            </div>
          )}

          {/* Info do grupo */}
          <div className={`flex items-center justify-center gap-2 text-muted-foreground bg-muted/50 rounded-lg py-3 transition-all duration-700 ${shouldBlur ? 'blur-md' : ''}`}>
            <Users className="h-4 w-4" />
            <span className="font-medium">{queueInfo.party_size} {queueInfo.party_size === 1 ? 'pessoa' : 'pessoas'}</span>
          </div>

          {/* Badge de status para outros status */}
          {consentSaved && queueInfo.status !== 'waiting' && queueInfo.status !== 'called' && (
            <div className="flex justify-center">
              <Badge variant={config.variant} className="text-sm px-4 py-2">
                <StatusIcon className={`mr-2 h-4 w-4 ${config.color}`} />
                {config.label}
              </Badge>
            </div>
          )}

          {consentSaved && (
            <>
              <div className="flex items-center justify-center gap-2 text-green-600 text-xs">
                <ShieldCheck className="h-3 w-3" />
                <span>Termos aceitos</span>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Fique de olho! Avisaremos quando for a sua vez.
              </p>
            </>
          )}

          <div className="pt-4 border-t border-border/50 flex justify-center">
            <img src="/images/mesaclik-logo-3d.png" alt="MesaClik" className="h-8 opacity-60" />
          </div>
        </CardContent>
      </Card>

      {/* Modal de consentimento */}
      <Dialog open={showModal} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="p-6 space-y-5">
            {/* Ícone */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>

            <DialogHeader className="text-center space-y-2">
              <DialogTitle className="text-xl font-bold text-foreground">Antes de continuar</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                Para garantir a melhor experiência e seus direitos como cliente, precisamos do seu aceite.
              </DialogDescription>
            </DialogHeader>

            {/* Checkbox obrigatório - Termos */}
            <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-xl border">
              <Checkbox
                id="terms-modal"
                checked={termsAccepted}
                onCheckedChange={(c) => setTermsAccepted(c === true)}
                className="mt-0.5"
              />
              <Label htmlFor="terms-modal" className="text-sm font-medium leading-tight cursor-pointer">
                Li e aceito os{' '}
                <Link to="/termos" target="_blank" className="text-orange-600 hover:text-orange-700 underline font-semibold" onClick={e => e.stopPropagation()}>
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link to="/privacidade" target="_blank" className="text-orange-600 hover:text-orange-700 underline font-semibold" onClick={e => e.stopPropagation()}>
                  Política de Privacidade
                </Link>{' '}
                do MesaClik.
              </Label>
            </div>

            {/* Checkbox opcional - Marketing */}
            <div className="flex items-start space-x-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
              <Checkbox
                id="marketing-modal"
                checked={marketingOptin}
                onCheckedChange={(c) => setMarketingOptin(c === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="marketing-modal" className="text-sm font-medium leading-tight cursor-pointer">
                  Aceito receber promoções e comunicações do restaurante por e-mail.
                </Label>
                <p className="text-xs text-muted-foreground italic">(opcional)</p>
                <p className="text-xs text-muted-foreground">Você pode cancelar a qualquer momento.</p>
              </div>
            </div>

            {/* Botão */}
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-6 text-base rounded-xl shadow-lg disabled:opacity-50 disabled:bg-gray-300 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-300"
              disabled={!termsAccepted}
              onClick={handleAcceptTerms}
            >
              Ver minha posição na fila
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

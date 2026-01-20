/**
 * Página de acompanhamento em tempo real da fila
 * Mostra posição calculada por GRUPO (igual à tela comando)
 * Rota: /fila/final?restauranteId=...
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFilaWeb, QueueStatus } from '@/hooks/useFilaWeb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Users, Clock, XCircle, CheckCircle2, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function FilaFinal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const restauranteId = searchParams.get('restauranteId');

  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [aceitouOfertas, setAceitouOfertas] = useState(false);

  const { 
    loading, 
    getQueueStatus, 
    getRestaurantName, 
    updateConsent,
    cancelQueueEntry,
    checkAuth
  } = useFilaWeb();

  const fetchStatus = useCallback(async () => {
    if (!restauranteId) return;
    
    setRefreshing(true);
    const status = await getQueueStatus(restauranteId);
    setQueueStatus(status);
    
    if (status.consent) {
      setAceitouOfertas(status.consent.aceitou_ofertas_email);
    }
    
    setRefreshing(false);
  }, [restauranteId, getQueueStatus]);

  // Inicialização
  useEffect(() => {
    const init = async () => {
      if (!restauranteId) return;

      // Verificar autenticação
      const isAuth = await checkAuth();
      if (!isAuth) {
        navigate(`/fila/entrar?restauranteId=${restauranteId}`);
        return;
      }

      // Buscar nome e status
      const name = await getRestaurantName(restauranteId);
      setRestaurantName(name);
      
      await fetchStatus();
    };

    init();
  }, [restauranteId, getRestaurantName, checkAuth, navigate, fetchStatus]);

  // Real-time subscription para atualizações da fila
  useEffect(() => {
    if (!restauranteId || !queueStatus?.in_queue) return;

    // Subscrever para mudanças em tempo real na tabela fila_entradas
    const channel = supabase
      .channel(`fila-updates-${restauranteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fila_entradas',
          filter: `restaurante_id=eq.${restauranteId}`,
        },
        (payload) => {
          console.log('Fila atualizada em tempo real:', payload);
          // Recalcular posição quando qualquer entrada mudar
          fetchStatus();
        }
      )
      .subscribe();

    // Fallback polling a cada 15s (caso realtime falhe)
    const interval = setInterval(fetchStatus, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [restauranteId, queueStatus?.in_queue, fetchStatus]);

  const handleConsentChange = async (checked: boolean) => {
    if (!restauranteId) return;
    
    setAceitouOfertas(checked);
    const success = await updateConsent(restauranteId, { aceitou_ofertas_email: checked });
    
    if (success) {
      toast({
        title: checked ? 'Ofertas ativadas' : 'Ofertas desativadas',
        description: checked 
          ? 'Você receberá ofertas exclusivas por e-mail.'
          : 'Você não receberá mais ofertas por e-mail.',
      });
    }
  };

  const handleCancel = async () => {
    if (!restauranteId) return;
    
    const success = await cancelQueueEntry(restauranteId);
    if (success) {
      navigate(`/fila/entrar?restauranteId=${restauranteId}`);
    }
  };

  // Loading
  if (loading && !queueStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando sua posição...</p>
        </div>
      </div>
    );
  }

  // Não está na fila
  if (queueStatus && !queueStatus.in_queue) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Você não está na fila</CardTitle>
            <CardDescription>
              {queueStatus.error || 'Entre na fila para acompanhar sua posição.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full"
              onClick={() => navigate(`/fila/entrar?restauranteId=${restauranteId}`)}
            >
              Entrar na fila
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = {
    aguardando: { 
      label: 'Aguardando', 
      variant: 'secondary' as const,
      icon: Clock,
      color: 'text-muted-foreground'
    },
    chamado: { 
      label: 'CHAMADO!', 
      variant: 'default' as const,
      icon: Bell,
      color: 'text-primary'
    },
    finalizado: { 
      label: 'Finalizado', 
      variant: 'outline' as const,
      icon: CheckCircle2,
      color: 'text-green-600'
    },
    cancelado: { 
      label: 'Cancelado', 
      variant: 'destructive' as const,
      icon: XCircle,
      color: 'text-destructive'
    },
  };

  const currentStatus = queueStatus?.status || 'aguardando';
  const config = statusConfig[currentStatus];
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        {/* Header com gradiente laranja */}
        <CardHeader className="text-center space-y-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg pb-6">
          <div className="text-3xl mb-2">🎉</div>
          <CardTitle className="text-2xl font-bold text-white">Você está na fila!</CardTitle>
          {restaurantName && (
            <CardDescription className="text-white/90 text-base">
              {restaurantName}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Status chamado */}
          {queueStatus?.status === 'chamado' && (
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
          {queueStatus?.status === 'aguardando' && (
            <div className="bg-orange-50 rounded-xl p-6 text-center">
              <p className="text-orange-800 text-sm font-semibold uppercase tracking-wide mb-2">
                SUA POSIÇÃO
              </p>
              <p className="text-6xl font-extrabold text-orange-500">
                {queueStatus.position || '-'}º
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Posição calculada por grupo na fila
              </p>
            </div>
          )}

          {/* Info do grupo */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground bg-muted/50 rounded-lg py-3">
            <Users className="h-4 w-4" />
            <span className="font-medium">{queueStatus?.party_size || 1} {(queueStatus?.party_size || 1) === 1 ? 'pessoa' : 'pessoas'}</span>
          </div>

          {/* Badge de status */}
          {queueStatus?.status !== 'aguardando' && queueStatus?.status !== 'chamado' && (
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
            onClick={fetchStatus}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar manualmente
          </Button>

          {/* Consentimento de ofertas */}
          <div className="flex items-start space-x-3 pt-4 border-t">
            <Checkbox
              id="ofertas"
              checked={aceitouOfertas}
              onCheckedChange={(checked) => handleConsentChange(!!checked)}
              className="border-orange-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="ofertas" className="text-sm font-medium cursor-pointer">
                Aceito receber ofertas por e-mail
              </Label>
              <p className="text-xs text-muted-foreground">
                Receba promoções e novidades exclusivas deste restaurante.
              </p>
            </div>
          </div>

          {/* Cancelar */}
          {(queueStatus?.status === 'aguardando' || queueStatus?.status === 'chamado') && (
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleCancel}
              disabled={loading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Sair da fila
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

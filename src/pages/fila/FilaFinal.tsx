/**
 * Página placeholder para status da fila
 * Esta página será substituída/integrada com o app do Cursor
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

  // Polling automático (10s)
  useEffect(() => {
    if (!restauranteId || !queueStatus?.in_queue) return;

    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          {restaurantName && (
            <CardDescription className="text-lg font-medium">
              {restaurantName}
            </CardDescription>
          )}
          
          <div className="space-y-4">
            <Badge variant={config.variant} className="text-lg px-4 py-2">
              <StatusIcon className={`mr-2 h-5 w-5 ${config.color}`} />
              {config.label}
            </Badge>

            {queueStatus?.status === 'chamado' && (
              <div className="animate-pulse bg-primary/10 rounded-lg p-4">
                <p className="text-primary font-bold text-xl">
                  🎉 É a sua vez!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Dirija-se ao balcão
                </p>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Posição na fila */}
          {queueStatus?.status === 'aguardando' && (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Sua posição</p>
              <p className="text-6xl font-bold text-primary">
                {queueStatus.position || '-'}º
              </p>
            </div>
          )}

          {/* Info do grupo */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{queueStatus?.party_size || 1} {(queueStatus?.party_size || 1) === 1 ? 'pessoa' : 'pessoas'}</span>
          </div>

          {/* Botão atualizar */}
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
            Atualizar
          </Button>

          {/* Consentimento de ofertas */}
          <div className="flex items-start space-x-3 pt-4 border-t">
            <Checkbox
              id="ofertas"
              checked={aceitouOfertas}
              onCheckedChange={(checked) => handleConsentChange(!!checked)}
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

          <p className="text-xs text-center text-muted-foreground">
            Atualização automática a cada 10 segundos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

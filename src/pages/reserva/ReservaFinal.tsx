/**
 * Página de visualização de reserva com experiência premium
 * - Consentimento LGPD obrigatório antes de exibir dados
 * - Bloco de informações do restaurante e da reserva
 * - Ações: cancelar reserva, abrir no Maps
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  XCircle, 
  CheckCircle2, 
  ShieldCheck,
  Navigation,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

interface ReservationInfo {
  reservation_id: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address: string | null;
  restaurant_cuisine: string | null;
  customer_name: string;
  customer_email: string | null;
  phone: string | null;
  party_size: number;
  reservation_datetime: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show';
  notes: string | null;
  cancel_reason: string | null;
  canceled_at: string | null;
  tolerance_minutes: number;
}

export default function ReservaFinal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const reservationId = searchParams.get('id');

  const [reservationInfo, setReservationInfo] = useState<ReservationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  // Estado de consentimento
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [offersOptIn, setOffersOptIn] = useState(false);
  
  // Estado de cancelamento
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // Atualizar título
  useEffect(() => {
    document.title = 'MesaClik - Minha Reserva';
  }, []);

  // Buscar informações da reserva
  const fetchReservationInfo = useCallback(async () => {
    if (!reservationId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-reservation-info', {
        body: { reservation_id: reservationId },
      });

      if (error || !data || data.found === false) {
        console.error('Reserva não encontrada:', error || data);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setReservationInfo(data);
      setNotFound(false);
    } catch (err) {
      console.error('Erro ao buscar reserva:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    fetchReservationInfo();
  }, [fetchReservationInfo]);

  // Handler para confirmar consentimento
  const handleConfirmConsent = async () => {
    if (!reservationInfo) return;
    
    setSavingConsent(true);
    try {
      // Salvar preferência de marketing se optou por receber ofertas
      if (offersOptIn && reservationInfo.customer_email) {
        // Upsert em restaurant_marketing_optins
        const { error: optinError } = await supabase
          .from('restaurant_marketing_optins')
          .upsert({
            restaurant_id: reservationInfo.restaurant_id,
            customer_email: reservationInfo.customer_email,
            customer_name: reservationInfo.customer_name,
            marketing_optin: true,
            marketing_optin_at: new Date().toISOString(),
          }, {
            onConflict: 'restaurant_id,customer_email'
          });

        if (optinError) {
          console.error('Erro ao salvar opt-in de marketing:', optinError);
        }

        // Atualizar restaurant_customers também
        const { error: customerError } = await supabase
          .from('restaurant_customers')
          .upsert({
            restaurant_id: reservationInfo.restaurant_id,
            customer_email: reservationInfo.customer_email,
            customer_name: reservationInfo.customer_name,
            marketing_optin: true,
            marketing_optin_at: new Date().toISOString(),
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          }, {
            onConflict: 'restaurant_id,customer_email'
          });

        if (customerError) {
          console.error('Erro ao atualizar customer:', customerError);
        }
      } else if (reservationInfo.customer_email) {
        // Apenas salvar aceite de termos sem marketing
        const { error: customerError } = await supabase
          .from('restaurant_customers')
          .upsert({
            restaurant_id: reservationInfo.restaurant_id,
            customer_email: reservationInfo.customer_email,
            customer_name: reservationInfo.customer_name,
            marketing_optin: false,
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          }, {
            onConflict: 'restaurant_id,customer_email'
          });

        if (customerError) {
          console.error('Erro ao atualizar customer:', customerError);
        }
      }

      setConsentConfirmed(true);
    } catch (err) {
      console.error('Erro ao salvar consentimento:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar suas preferências. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSavingConsent(false);
    }
  };

  // Handler para cancelar reserva
  const handleCancelReservation = async () => {
    if (!reservationInfo) return;
    
    setCanceling(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ 
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          canceled_by: 'customer',
          cancel_reason: 'Cancelado pelo cliente'
        })
        .eq('id', reservationInfo.reservation_id);

      if (error) throw error;

      toast({
        title: 'Reserva cancelada',
        description: 'Sua reserva foi cancelada com sucesso.',
      });

      // Atualizar estado local
      setReservationInfo(prev => prev ? { ...prev, status: 'canceled' } : null);
      setShowCancelDialog(false);
    } catch (err) {
      console.error('Erro ao cancelar reserva:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar a reserva. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCanceling(false);
    }
  };

  // Abrir Google Maps
  const openGoogleMaps = () => {
    if (!reservationInfo?.restaurant_address) return;
    const encodedAddress = encodeURIComponent(reservationInfo.restaurant_address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  // Formatar data e hora
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando sua reserva...</p>
        </div>
      </div>
    );
  }

  // Não encontrado
  if (notFound || !reservationInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Reserva não encontrada</CardTitle>
            <CardDescription>
              O link pode ter expirado ou a reserva foi cancelada.
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

  const { date, time } = formatDateTime(reservationInfo.reservation_datetime);

  const statusConfig = {
    pending: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
    confirmed: { label: 'Confirmada', color: 'bg-green-500', icon: CheckCircle2 },
    seated: { label: 'Sentado', color: 'bg-blue-500', icon: CheckCircle2 },
    completed: { label: 'Concluída', color: 'bg-gray-500', icon: CheckCircle2 },
    canceled: { label: 'Cancelada', color: 'bg-red-500', icon: XCircle },
    no_show: { label: 'Não compareceu', color: 'bg-red-500', icon: AlertTriangle },
  };

  const config = statusConfig[reservationInfo.status];
  const StatusIcon = config.icon;
  const isCanceled = reservationInfo.status === 'canceled' || reservationInfo.status === 'no_show';
  const canCancel = ['pending', 'confirmed'].includes(reservationInfo.status);

  // Tela de consentimento
  if (!consentConfirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center space-y-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg pb-6">
            <ShieldCheck className="h-12 w-12 mx-auto mb-2" />
            <CardTitle className="text-2xl font-bold text-white">Sua Reserva</CardTitle>
            <CardDescription className="text-white/90 text-base">
              {reservationInfo.restaurant_name}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <p className="text-center text-muted-foreground">
              Para visualizar os detalhes da sua reserva, por favor aceite nossos termos.
            </p>

            {/* Checkbox de termos (obrigatório) */}
            <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg border">
              <Checkbox
                id="terms-consent"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                disabled={savingConsent}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="terms-consent"
                  className="text-sm font-medium leading-tight cursor-pointer"
                >
                  Li e aceito os{' '}
                  <Link
                    to="/termos"
                    target="_blank"
                    className="text-green-600 hover:text-green-700 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Termos de Uso
                  </Link>{' '}
                  e a{' '}
                  <Link
                    to="/privacidade"
                    target="_blank"
                    className="text-green-600 hover:text-green-700 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Política de Privacidade
                  </Link>{' '}
                  do MesaClik.
                </Label>
                <p className="text-xs text-destructive font-medium">
                  * Obrigatório para continuar
                </p>
              </div>
            </div>

            {/* Checkbox de ofertas (opcional) */}
            <div className="flex items-start space-x-3 p-4 bg-green-50/50 rounded-lg border border-green-200/50">
              <Checkbox
                id="offers-consent"
                checked={offersOptIn}
                onCheckedChange={(checked) => setOffersOptIn(checked === true)}
                disabled={savingConsent}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="offers-consent"
                  className="text-sm font-medium leading-tight cursor-pointer"
                >
                  Aceito receber ofertas e promoções por e-mail
                </Label>
                <p className="text-xs text-muted-foreground">
                  Opcional - Você pode cancelar a qualquer momento
                </p>
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-6"
              disabled={!termsAccepted || savingConsent}
              onClick={handleConfirmConsent}
            >
              {savingConsent ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                '📋 Ver minha reserva'
              )}
            </Button>

            {!termsAccepted && (
              <p className="text-center text-xs text-muted-foreground">
                Marque a caixa de termos acima para continuar
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela principal da reserva
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background p-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header com status */}
        <Card className="shadow-xl border-0 overflow-hidden">
          <CardHeader className={`text-center space-y-2 ${isCanceled ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-green-500 to-green-600'} text-white pb-6`}>
            <div className="text-4xl mb-2">{isCanceled ? '❌' : '✅'}</div>
            <CardTitle className="text-2xl font-bold text-white">
              {isCanceled ? 'Reserva Cancelada' : 'Reserva Confirmada!'}
            </CardTitle>
            <CardDescription className="text-white/90 text-base">
              Você fez uma reserva no restaurante
            </CardDescription>
            <p className="text-white font-semibold text-lg">{reservationInfo.restaurant_name}</p>
          </CardHeader>
        </Card>

        {/* Bloco Restaurante */}
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              Restaurante
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-lg">{reservationInfo.restaurant_name}</p>
              {reservationInfo.restaurant_cuisine && (
                <Badge variant="secondary" className="mt-1">
                  {reservationInfo.restaurant_cuisine}
                </Badge>
              )}
            </div>
            {reservationInfo.restaurant_address && (
              <p className="text-muted-foreground text-sm">
                {reservationInfo.restaurant_address}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Bloco Reserva */}
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Detalhes da Reserva
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-5 w-5 ${isCanceled ? 'text-red-500' : 'text-green-500'}`} />
              <span className="font-medium">Status:</span>
              <Badge className={config.color}>{config.label}</Badge>
            </div>

            {/* Data */}
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold capitalize">{date}</p>
              </div>
            </div>

            {/* Horário */}
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Clock className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold">{time}</p>
              </div>
            </div>

            {/* Pessoas */}
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold">
                  {reservationInfo.party_size} {reservationInfo.party_size === 1 ? 'pessoa' : 'pessoas'}
                </p>
              </div>
            </div>

            {/* Tolerância */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200/50">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-700">
                  Tolerância: {reservationInfo.tolerance_minutes} minutos
                </p>
                <p className="text-xs text-amber-600/80">
                  Após este tempo, a reserva pode ser cancelada automaticamente
                </p>
              </div>
            </div>

            {/* Observações */}
            {reservationInfo.notes && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground font-medium mb-1">Observações:</p>
                <p className="text-sm">{reservationInfo.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bloco Ações */}
        <Card className="shadow-lg">
          <CardContent className="pt-6 space-y-3">
            {/* Abrir no Maps */}
            {reservationInfo.restaurant_address && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={openGoogleMaps}
              >
                <Navigation className="h-4 w-4" />
                Abrir endereço no Google Maps
              </Button>
            )}

            {/* Cancelar Reserva */}
            {canCancel && (
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="h-4 w-4" />
                Cancelar reserva
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Rodapé */}
        <div className="text-center py-4">
          <p className="text-sm text-green-600 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Reserva realizada com segurança via MesaClik
          </p>
        </div>
      </div>

      {/* Dialog de cancelamento */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar sua reserva para {date} às {time}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelReservation}
              disabled={canceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {canceling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Sim, cancelar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

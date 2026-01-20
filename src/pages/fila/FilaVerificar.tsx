/**
 * Página de verificação OTP - Confirma código e cria entrada na fila
 * Rota: /fila/verificar?restauranteId=...&email=...
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFilaWeb } from '@/hooks/useFilaWeb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, Users, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function FilaVerificar() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const restauranteId = searchParams.get('restauranteId');
  const emailParam = searchParams.get('email');

  const [code, setCode] = useState('');
  const [partySize, setPartySize] = useState('1');
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [step, setStep] = useState<'verify' | 'party_size'>('verify');
  const [isAlreadyAuth, setIsAlreadyAuth] = useState(false);

  const { 
    loading, 
    verifyOtp, 
    createQueueEntry, 
    getRestaurantName, 
    checkAuth,
    sendOtp 
  } = useFilaWeb();

  // Verificar autenticação e buscar nome do restaurante
  useEffect(() => {
    const init = async () => {
      if (!restauranteId) return;

      // Buscar nome do restaurante
      const name = await getRestaurantName(restauranteId);
      setRestaurantName(name);

      // Verificar se já está autenticado
      const isAuth = await checkAuth();
      if (isAuth) {
        setIsAlreadyAuth(true);
        setStep('party_size');
      }
    };

    init();

    // Listener para mudanças de auth (magic link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setIsAlreadyAuth(true);
        setStep('party_size');
      }
    });

    return () => subscription.unsubscribe();
  }, [restauranteId, getRestaurantName, checkAuth]);

  const handleVerifyCode = async () => {
    if (!emailParam || code.length !== 6) return;

    const success = await verifyOtp(emailParam, code);
    if (success) {
      setStep('party_size');
    }
  };

  const handleCreateEntry = async () => {
    if (!restauranteId) return;

    const result = await createQueueEntry(restauranteId, parseInt(partySize));
    
    if (result.success && result.entry_id) {
      // Redirecionar para página de status (no Cursor)
      // A URL deve ser configurada de acordo com o app do Cursor
      navigate(`/fila/final?restauranteId=${restauranteId}`);
    }
  };

  const handleResendCode = async () => {
    if (!emailParam || !restauranteId || emailParam === 'authenticated') return;
    await sendOtp(emailParam, restauranteId);
  };

  const handleGoBack = useCallback(() => {
    if (restauranteId) {
      navigate(`/fila/entrar?restauranteId=${restauranteId}`);
    }
  }, [navigate, restauranteId]);

  // Validações
  if (!restauranteId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Link inválido</CardTitle>
            <CardDescription>
              O restaurante não foi especificado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!emailParam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">E-mail não informado</CardTitle>
            <CardDescription>
              Por favor, volte e informe seu e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleGoBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            {step === 'verify' ? (
              <ShieldCheck className="h-6 w-6 text-primary" />
            ) : (
              <Users className="h-6 w-6 text-primary" />
            )}
          </div>
          
          <CardTitle className="text-2xl">
            {step === 'verify' ? 'Verificar código' : 'Quantas pessoas?'}
          </CardTitle>
          
          {restaurantName && (
            <CardDescription className="text-lg font-medium">
              {restaurantName}
            </CardDescription>
          )}
          
          <CardDescription>
            {step === 'verify' 
              ? `Digite o código de 6 dígitos enviado para ${emailParam}`
              : 'Selecione o tamanho do seu grupo'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 'verify' && !isAlreadyAuth && (
            <>
              <div className="space-y-4">
                <Label htmlFor="otp" className="sr-only">Código de verificação</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(value) => setCode(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </Button>

              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  Reenviar código
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={handleGoBack}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Usar outro e-mail
                </Button>
              </div>
            </>
          )}

          {step === 'party_size' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="party_size">Número de pessoas</Label>
                <Select value={partySize} onValueChange={setPartySize}>
                  <SelectTrigger id="party_size">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} {n === 1 ? 'pessoa' : 'pessoas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={handleCreateEntry}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando na fila...
                  </>
                ) : (
                  'Entrar na fila'
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

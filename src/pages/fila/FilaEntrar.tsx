/**
 * Página de entrada na fila - Solicita e-mail para OTP
 * Rota: /fila/entrar?restauranteId=...
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFilaWeb } from '@/hooks/useFilaWeb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Users } from 'lucide-react';

export default function FilaEntrar() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const restauranteId = searchParams.get('restauranteId');

  const [email, setEmail] = useState('');
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [validatingRestaurant, setValidatingRestaurant] = useState(true);
  const [restaurantValid, setRestaurantValid] = useState(false);

  const { loading, sendOtp, validateRestaurant, getRestaurantName, checkAuth } = useFilaWeb();

  // Validar restaurante ao montar
  useEffect(() => {
    const init = async () => {
      if (!restauranteId) {
        setValidatingRestaurant(false);
        return;
      }

      // Verificar se já está autenticado
      const isAuth = await checkAuth();
      if (isAuth) {
        // Se já autenticado, redirecionar para verificação
        navigate(`/fila/verificar?restauranteId=${restauranteId}&email=authenticated`);
        return;
      }

      // Validar restaurante
      const isValid = await validateRestaurant(restauranteId);
      setRestaurantValid(isValid);

      if (isValid) {
        const name = await getRestaurantName(restauranteId);
        setRestaurantName(name);
      }

      setValidatingRestaurant(false);
    };

    init();
  }, [restauranteId, validateRestaurant, getRestaurantName, checkAuth, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !restauranteId) return;

    // Validar e-mail básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return;
    }

    const success = await sendOtp(email, restauranteId);
    if (success) {
      // Redirecionar para verificação
      navigate(`/fila/verificar?restauranteId=${restauranteId}&email=${encodeURIComponent(email)}`);
    }
  };

  // Loading inicial
  if (validatingRestaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Restaurante inválido
  if (!restauranteId || !restaurantValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Link inválido</CardTitle>
            <CardDescription>
              O restaurante não foi encontrado ou o link está incorreto.
              Por favor, solicite um novo link ao estabelecimento.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Entrar na Fila</CardTitle>
          {restaurantName && (
            <CardDescription className="text-lg font-medium">
              {restaurantName}
            </CardDescription>
          )}
          <CardDescription>
            Digite seu e-mail para receber um código de verificação
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar código'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao continuar, você concorda em receber um e-mail com o código de verificação.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { ReactNode } from 'react';
import { Loader2, ShieldAlert, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRestaurant } from '@/contexts/RestaurantContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

/**
 * Componente de proteção de rota para o painel MesaClik.
 * 
 * ARQUITETURA:
 * - O login é realizado no SITE institucional (externo)
 * - A sessão/token é compartilhada via Supabase Auth
 * - Este componente valida se existe sessão E restaurante antes de renderizar
 * 
 * SEGURANÇA:
 * - Sem bypass de desenvolvimento - sempre requer autenticação real
 * - Valida que o usuário tem acesso a um restaurante específico
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, restaurant, isLoading, isAuthenticated, error } = useRestaurant();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Usuário não autenticado
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Você precisa estar logado para acessar esta página.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Faça login no site MesaClik para acessar o painel de controle do seu restaurante.
            </p>
            <Button 
              className="w-full"
              onClick={() => {
                // Redirecionar para o site de login
                window.location.href = 'https://mesaclik.com.br/login';
              }}
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Usuário autenticado mas sem restaurante associado
  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-warning" />
            </div>
            <CardTitle>Nenhum Restaurante Encontrado</CardTitle>
            <CardDescription>
              {error || 'Você não está associado a nenhum restaurante.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Se você é dono de um restaurante, complete o cadastro no site MesaClik.
              Se você é funcionário, peça ao administrador para adicionar seu acesso.
            </p>
            <div className="flex flex-col gap-2">
              <Button 
                className="w-full"
                onClick={() => {
                  window.location.href = 'https://mesaclik.com.br/cadastro';
                }}
              >
                Cadastrar Restaurante
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = 'https://mesaclik.com.br/suporte';
                }}
              >
                Falar com Suporte
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // TODO: Implementar verificação de admin se requireAdmin = true
  // Por enquanto, qualquer usuário com restaurante associado tem acesso

  return <>{children}</>;
}

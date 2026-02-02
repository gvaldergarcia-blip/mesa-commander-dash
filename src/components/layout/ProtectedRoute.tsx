import { useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
 * - Este componente valida se existe sessão antes de renderizar
 * 
 * EM DESENVOLVIMENTO:
 * - Se não houver sessão, mostra tela de bloqueio
 * - Se o owner do restaurante for admin, permite bypass (dev mode)
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setIsAuthenticated(true);
          
          // Verificar se é admin
          if (requireAdmin) {
            const { data: roles } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);

            const hasAdminRole = roles?.some(r => 
              r.role === 'admin' || r.role === 'owner' || r.role === 'manager'
            );
            
            setIsAdmin(hasAdminRole || false);
          } else {
            setIsAdmin(true); // Se não requer admin, considera válido
          }
        } else {
          // DEV MODE: Permitir acesso se o restaurante pertence a um admin
          // Em produção, isso seria removido e redirecionaria para o site de login
          const isDevelopment = import.meta.env.DEV || window.location.hostname.includes('lovable.app');
          
          if (isDevelopment) {
            // Em desenvolvimento, permitir acesso para testes
            console.warn('[ProtectedRoute] DEV MODE: Acesso sem sessão permitido para testes');
            setIsAuthenticated(true);
            setIsAdmin(true);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('[ProtectedRoute] Error checking auth:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setIsAdmin(false);
      } else if (session?.user) {
        setIsAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [requireAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
              Faça login no site MesaClik para acessar o painel de controle.
            </p>
            <Button 
              className="w-full"
              onClick={() => {
                // Em produção, redirecionar para o site de login
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

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-warning" />
            </div>
            <CardTitle>Permissão Negada</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Entre em contato com o administrador do restaurante.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

import { ReactNode } from 'react';
import { Loader2, Building2 } from 'lucide-react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import Login from '@/pages/Login';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

/**
 * Componente de proteção de rota para o painel MesaClik.
 * 
 * Valida:
 * 1. Sessão Supabase ativa (isAuthenticated)
 * 2. Restaurante vinculado ao usuário (restaurantId)
 * 3. Bloqueia acesso se não atender os requisitos
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, restaurantId, error } = useRestaurant();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Sem sessão válida — mostrar login
  if (!isAuthenticated) {
    return <Login />;
  }

  // Sem restaurante vinculado — bloqueia sempre
  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <Building2 className="h-12 w-12 text-warning mx-auto opacity-70" />
          <h2 className="text-xl font-semibold text-foreground">Conta sem restaurante vinculado</h2>
          <p className="text-sm text-muted-foreground">
            {error || 'Sua conta ainda não está associada a nenhum restaurante. Entre em contato com o suporte.'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

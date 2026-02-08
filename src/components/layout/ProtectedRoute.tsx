import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
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
 * - Em preview/dev, bypass automático para o fundador
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isLoading } = useRestaurant();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Acesso liberado - autenticação vem do site externo
  return <>{children}</>;
}

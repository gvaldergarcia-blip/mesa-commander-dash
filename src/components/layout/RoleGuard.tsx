import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useToast } from '@/hooks/use-toast';

interface RoleGuardProps {
  requireAdmin?: boolean;
  children: ReactNode;
}

/**
 * Protege rotas que exigem perfil ADMIN.
 * Se o usuário for OPERADOR, redireciona para /dashboard com toast.
 */
export function RoleGuard({ requireAdmin = true, children }: RoleGuardProps) {
  const { userRole, isLoading } = useRestaurant();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!isLoading && requireAdmin && !isAdmin) {
      toast({
        title: 'Acesso restrito',
        description: 'Você não tem permissão para acessar esta área.',
        variant: 'destructive',
      });
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, requireAdmin, isAdmin, navigate, toast]);

  if (isLoading) return null;
  if (requireAdmin && !isAdmin) return null;

  return <>{children}</>;
}

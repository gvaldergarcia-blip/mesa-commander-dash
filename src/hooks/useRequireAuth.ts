import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseRequireAuthOptions {
  requireAdmin?: boolean;
  redirectTo?: string;
}

export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const { requireAdmin = false, redirectTo = '/' } = options;
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          toast({
            title: 'Acesso restrito',
            description: 'Você precisa estar logado para acessar esta página.',
            variant: 'destructive',
          });
          navigate(redirectTo);
          return;
        }

        setUserId(session.user.id);
        setIsAuthenticated(true);

        // Check if user has admin role
        if (requireAdmin) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id);

          const hasAdminRole = roles?.some(r => 
            r.role === 'admin' || r.role === 'owner' || r.role === 'manager'
          );

          if (!hasAdminRole) {
            toast({
              title: 'Acesso negado',
              description: 'Você não tem permissão para acessar esta página.',
              variant: 'destructive',
            });
            navigate(redirectTo);
            return;
          }

          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        navigate(redirectTo);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate(redirectTo);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo, requireAdmin, toast]);

  return { loading, isAuthenticated, isAdmin, userId };
}

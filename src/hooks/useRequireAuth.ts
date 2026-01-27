import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseRequireAuthOptions {
  requireAdmin?: boolean;
  redirectTo?: string;
}

// Preview bypass: no ambiente de preview, pula autenticação para o founder
const isPreview = typeof window !== 'undefined' && 
  (window.location.hostname.includes('lovable.app') || 
   window.location.hostname.includes('lovableproject.com') ||
   window.location.hostname === 'localhost');

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
        // Em Preview, bypass completo - acesso direto do founder
        if (isPreview) {
          console.log('[Auth] Preview mode - founder access granted');
          setIsAuthenticated(true);
          setIsAdmin(true);
          setUserId('b01b96fb-bd8c-46d6-b168-b4d11ffdd208'); // Founder ID
          setLoading(false);
          return;
        }

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
        if (!isPreview) {
          navigate(redirectTo);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Em Preview, não precisa listener de auth
    if (isPreview) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate(redirectTo);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo, requireAdmin, toast]);

  return { loading, isAuthenticated, isAdmin, userId };
}

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  address_line: string | null;
  cuisine: string;
  owner_id: string | null;
}

interface RestaurantContextType {
  restaurant: Restaurant | null;
  restaurantId: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

// ID do fundador para bypass em preview
const FOUNDER_ID = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208';

// Restaurante padrão para preview (Mocotó)
const DEFAULT_RESTAURANT_ID = '8e5d4e30-3432-410a-bcd2-35a4fb5b8e9f';

interface RestaurantProviderProps {
  children: ReactNode;
}

export function RestaurantProvider({ children }: RestaurantProviderProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPreviewEnvironment = () => {
    return import.meta.env.DEV || 
           window.location.hostname.includes('lovable.app') ||
           window.location.hostname === 'localhost';
  };

  const fetchRestaurantForUser = async (userId: string) => {
    try {
      setError(null);
      
      // 1. Verificar se é admin
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      // 2. Buscar restaurante do usuário via membership
      const { data: membership } = await supabase
        .from('restaurant_members')
        .select('restaurant_id, role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      
      let targetRestaurantId: string | null = null;
      
      if (membership?.restaurant_id) {
        targetRestaurantId = membership.restaurant_id;
      } else if (adminRole) {
        // Admin: usar restaurante padrão em preview
        targetRestaurantId = DEFAULT_RESTAURANT_ID;
      }
      
      if (!targetRestaurantId) {
        // Fallback para restaurante padrão em preview
        if (isPreviewEnvironment()) {
          targetRestaurantId = DEFAULT_RESTAURANT_ID;
        } else {
          setRestaurant(null);
          setError('Nenhum restaurante associado');
          return;
        }
      }
      
      // 3. Buscar dados do restaurante
      const { data: restaurantData, error: restaurantError } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurants')
        .select('id, name, logo_url, address_line, cuisine, owner_id')
        .eq('id', targetRestaurantId)
        .single();
      
      if (restaurantError) {
        console.error('[RestaurantContext] Error:', restaurantError);
        setError('Erro ao carregar restaurante');
        return;
      }
      
      setRestaurant(restaurantData);
      
    } catch (err) {
      console.error('[RestaurantContext] Unexpected error:', err);
      setError('Erro inesperado');
    }
  };

  const fetchDefaultRestaurant = async () => {
    try {
      const { data, error } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurants')
        .select('id, name, logo_url, address_line, cuisine, owner_id')
        .eq('id', DEFAULT_RESTAURANT_ID)
        .single();
      
      if (!error && data) {
        setRestaurant(data);
      }
    } catch (err) {
      console.error('[RestaurantContext] Error fetching default:', err);
    }
  };

  const refetch = async () => {
    if (user) {
      await fetchRestaurantForUser(user.id);
    } else if (isPreviewEnvironment()) {
      await fetchDefaultRestaurant();
    }
  };

  useEffect(() => {
    let isMounted = true;

    const restoreSessionFromUrl = async (): Promise<boolean> => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        console.log('[RestaurantContext] Restaurando sessão via URL tokens...');
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        // Limpar tokens da URL
        window.history.replaceState({}, '', window.location.pathname);
        if (error) {
          console.error('[RestaurantContext] Erro ao restaurar sessão via URL:', error);
          return false;
        }
        console.log('[RestaurantContext] Sessão restaurada via URL com sucesso');
        return true;
      }
      return false;
    };

    const initialize = async () => {
      // 1. PRIMEIRO: tentar restaurar sessão de tokens na URL (vindo do site institucional)
      const restoredFromUrl = await restoreSessionFromUrl();

      // 2. Buscar sessão (já restaurada ou existente)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!isMounted) return;
      
      if (session?.user) {
        setUser(session.user);
        await fetchRestaurantForUser(session.user.id);
      } else if (isPreviewEnvironment()) {
        console.log('[RestaurantContext] Preview mode: using default restaurant');
        await fetchDefaultRestaurant();
      }
      
      if (isMounted) setIsLoading(false);
    };

    // Listener de auth para mudanças POSTERIORES (não controla isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      if (newUser) {
        setTimeout(() => {
          if (isMounted) fetchRestaurantForUser(newUser.id);
        }, 0);
      } else if (isPreviewEnvironment()) {
        setTimeout(() => {
          if (isMounted) fetchDefaultRestaurant();
        }, 0);
      }
    });

    initialize();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Realtime para atualizações do restaurante
  useEffect(() => {
    if (!restaurant?.id) return;

    const channel = supabase
      .channel(`restaurant-context-${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'mesaclik',
          table: 'restaurants',
          filter: `id=eq.${restaurant.id}`,
        },
        (payload) => {
          if (payload.new) {
            setRestaurant(prev => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  return (
    <RestaurantContext.Provider
      value={{
        restaurant,
        restaurantId: restaurant?.id ?? null,
        user,
        isLoading,
        isAuthenticated: !!user || isPreviewEnvironment(),
        error,
        refetch,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const context = useContext(RestaurantContext);
  
  if (context === undefined) {
    // Fallback seguro para evitar crash durante HMR ou ordem de montagem
    return {
      restaurant: null,
      restaurantId: null,
      user: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
      refetch: async () => {},
    } as RestaurantContextType;
  }
  
  return context;
}

export function useRestaurantId(): string {
  const { restaurantId } = useRestaurant();
  
  if (!restaurantId) {
    throw new Error('No restaurant available');
  }
  
  return restaurantId;
}

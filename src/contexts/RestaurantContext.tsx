import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface Restaurant {
  id: string;
  name: string;
  image_url: string | null;
  address_line: string | null;
  cuisine: string;
  owner_id: string | null;
}

export type UserRole = 'admin' | 'operator' | null;

interface RestaurantContextType {
  restaurant: Restaurant | null;
  restaurantId: string | null;
  user: User | null;
  userRole: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

// Sem restaurante padrão - cada usuário carrega o seu via restaurant_members
const DEFAULT_RESTAURANT_ID: string | null = null;

interface RestaurantProviderProps {
  children: ReactNode;
}

export function RestaurantProvider({ children }: RestaurantProviderProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
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
      
      // 1. Verificar se é admin (schema public explícito)
      const { data: adminRole } = await (supabase as any)
        .schema('public')
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      // 2. Buscar restaurante do usuário via membership (CRÍTICO: filtrar por user_id)
      const { data: membership } = await (supabase as any)
        .schema('public')
        .from('restaurant_members')
        .select('restaurant_id, role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      
      let targetRestaurantId: string | null = null;
      
      if (membership?.restaurant_id) {
        targetRestaurantId = membership.restaurant_id;
        // Resolve user role from membership
        const memberRole = (membership.role || 'operator').toLowerCase();
        setUserRole(memberRole === 'admin' || memberRole === 'owner' ? 'admin' : 'operator');
      } else if (adminRole && DEFAULT_RESTAURANT_ID) {
        // Admin sem membership: usar restaurante padrão apenas em dev
        targetRestaurantId = DEFAULT_RESTAURANT_ID;
      }
      
      // Check if admin via user_roles (global admin gets admin role)
      if (adminRole) {
        setUserRole('admin');
      }

      if (!targetRestaurantId) {
        setRestaurant(null);
        setError('Nenhum restaurante associado à sua conta. Verifique com o suporte.');
        return;
      }
      
      // 3. Buscar dados do restaurante (public.restaurants - sincronizado via trigger)
      const { data: restaurantData, error: restaurantError } = await (supabase as any)
        .schema('public')
        .from('restaurants')
        .select('id, name, image_url, address_line, cuisine, owner_id')
        .eq('id', targetRestaurantId)
        .single();
      
      if (restaurantError) {
        console.error('[RestaurantContext] Error:', restaurantError);
        setError('Erro ao carregar restaurante');
        return;
      }
      
      console.log('[RestaurantContext] Restaurante resolvido:', restaurantData?.name, 'para userId:', userId);
      setRestaurant(restaurantData);
      
    } catch (err) {
      console.error('[RestaurantContext] Unexpected error:', err);
      setError('Erro inesperado');
    }
  };

  const fetchDefaultRestaurant = async () => {
    // Sem restaurante padrão - usuário precisa estar autenticado e vinculado
    console.log('[RestaurantContext] Nenhum restaurante padrão configurado. Login necessário.');
  };

  const refetch = async () => {
    if (user) {
      await fetchRestaurantForUser(user.id);
    } else if (isPreviewEnvironment()) {
      await fetchDefaultRestaurant();
    }
  };

  // Ref to ensure initial load logic runs only once
  const initializedRef = useRef(false);
  // Ref to track which user's restaurant data we've already loaded
  const loadedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    // Prevent running initialization more than once
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    const restoreSessionFromUrl = async (): Promise<boolean> => {
      // Check query params (?access_token=...)
      let accessToken = new URLSearchParams(window.location.search).get('access_token');
      let refreshToken = new URLSearchParams(window.location.search).get('refresh_token');

      // Check hash fragments (#access_token=...) — used by iframe redirects
      if (!accessToken && window.location.hash.includes('access_token=')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      }

      if (accessToken && refreshToken) {
        console.log('[RestaurantContext] Restaurando sessão via URL/hash tokens...');
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState({}, '', window.location.pathname);
        if (error) {
          console.error('[RestaurantContext] Erro ao restaurar sessão via URL:', error);
          return false;
        }
        console.log('[RestaurantContext] Sessão restaurada via URL/hash com sucesso');
        return true;
      }
      return false;
    };

    const initialize = async () => {
      const urlHasTokens = window.location.search.includes('access_token') || window.location.hash.includes('access_token');
      console.log('[RestaurantContext] Initialize START', { urlHasTokens, href: window.location.href });

      const restoredFromUrl = await restoreSessionFromUrl();
      console.log('[RestaurantContext] After restoreSessionFromUrl', { restoredFromUrl });

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!isMounted) return;

      console.log('[RestaurantContext] Session check', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        email: session?.user?.email,
        isPreview: isPreviewEnvironment()
      });
      
      if (session?.user) {
        setUser(session.user);
        loadedForUserRef.current = session.user.id;
        await fetchRestaurantForUser(session.user.id);
      } else if (isPreviewEnvironment()) {
        console.log('[RestaurantContext] Preview mode: using default restaurant');
        await fetchDefaultRestaurant();
      } else {
        console.warn('[RestaurantContext] No session and not in preview. User has no access.');
      }
      
      if (isMounted) setIsLoading(false);
    };

    // Listener for ONGOING auth changes — does NOT control isLoading
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      if (event === 'SIGNED_OUT') {
        console.log('[RestaurantContext] SIGNED_OUT - limpando estado');
        loadedForUserRef.current = null;
        setRestaurant(null);
        setError(null);
        return;
      }

      // Only re-fetch restaurant if user actually changed
      if (newUser && newUser.id !== loadedForUserRef.current) {
        loadedForUserRef.current = newUser.id;
        setTimeout(() => {
          if (isMounted) fetchRestaurantForUser(newUser.id);
        }, 0);
      } else if (!newUser && isPreviewEnvironment()) {
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
          schema: 'public',
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
        userRole: userRole || (isPreviewEnvironment() ? 'admin' : null),
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
    return {
      restaurant: null,
      restaurantId: null,
      user: null,
      userRole: null,
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

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
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

interface RestaurantProviderProps {
  children: ReactNode;
}

export function RestaurantProvider({ children }: RestaurantProviderProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurantForUser = async (userId: string) => {
    try {
      setError(null);
      
      // 1. Primeiro, verificar se o usuário é admin (pode ver qualquer restaurante)
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      // 2. Buscar restaurante onde o usuário é membro
      const { data: membership, error: memberError } = await supabase
        .from('restaurant_members')
        .select('restaurant_id, role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      
      let targetRestaurantId: string | null = null;
      
      if (membership?.restaurant_id) {
        targetRestaurantId = membership.restaurant_id;
      } else if (adminRole) {
        // Admin sem membership específico: buscar primeiro restaurante disponível
        // Em produção, isso mostraria um seletor de restaurantes
        const { data: anyRestaurant } = await (supabase as any)
          .schema('mesaclik')
          .from('restaurants')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (anyRestaurant) {
          targetRestaurantId = anyRestaurant.id;
        }
      }
      
      if (!targetRestaurantId) {
        // Usuário não tem acesso a nenhum restaurante
        setRestaurant(null);
        setError('Você não tem acesso a nenhum restaurante. Entre em contato com o administrador.');
        return;
      }
      
      // 3. Buscar dados do restaurante
      const { data: restaurantData, error: restaurantError } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurants')
        .select('id, name, logo_url, address, cuisine, owner_id')
        .eq('id', targetRestaurantId)
        .single();
      
      if (restaurantError) {
        console.error('[RestaurantContext] Error fetching restaurant:', restaurantError);
        setError('Erro ao carregar dados do restaurante');
        return;
      }
      
      setRestaurant(restaurantData);
      console.log('[RestaurantContext] Restaurant loaded:', restaurantData.name);
      
    } catch (err) {
      console.error('[RestaurantContext] Unexpected error:', err);
      setError('Erro inesperado ao carregar restaurante');
    }
  };

  const refetch = async () => {
    if (user) {
      await fetchRestaurantForUser(user.id);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Listener de auth state PRIMEIRO
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      if (newUser) {
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          if (isMounted) {
            fetchRestaurantForUser(newUser.id);
          }
        }, 0);
      } else {
        setRestaurant(null);
        setIsLoading(false);
      }
    });

    // Depois verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        fetchRestaurantForUser(currentUser.id).finally(() => {
          if (isMounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

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
        isAuthenticated: !!user,
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
    throw new Error('useRestaurant must be used within a RestaurantProvider');
  }
  
  return context;
}

// Hook de compatibilidade para facilitar migração
export function useRestaurantId(): string {
  const { restaurantId } = useRestaurant();
  
  if (!restaurantId) {
    throw new Error('No restaurant available. User may not be authenticated or not assigned to a restaurant.');
  }
  
  return restaurantId;
}

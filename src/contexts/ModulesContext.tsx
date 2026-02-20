import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

export type PlanModules = 'FILA' | 'RESERVA' | 'FILA_RESERVA';

interface ModulesContextType {
  planModules: PlanModules | null;
  hasModule: (mod: 'fila' | 'reserva') => boolean;
  isLoading: boolean;
}

const ModulesContext = createContext<ModulesContextType | undefined>(undefined);

/**
 * Captura plan_modules do hash da URL (passado pelo site institucional)
 * ou consulta a coluna restaurants.plan_modules via Supabase como fallback.
 */
function getPlanModulesFromHash(): PlanModules | null {
  // Check hash fragments (#...&plan_modules=FILA)
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const pm = hashParams.get('plan_modules')?.toUpperCase();
    if (pm === 'FILA' || pm === 'RESERVA' || pm === 'FILA_RESERVA') {
      return pm as PlanModules;
    }
  }

  // Check query params (?plan_modules=FILA)
  const queryParams = new URLSearchParams(window.location.search);
  const pm = queryParams.get('plan_modules')?.toUpperCase();
  if (pm === 'FILA' || pm === 'RESERVA' || pm === 'FILA_RESERVA') {
    return pm as PlanModules;
  }

  return null;
}

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { restaurantId } = useRestaurant();
  const [planModules, setPlanModules] = useState<PlanModules | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Try to capture from URL hash/query (set once on mount)
    const fromUrl = getPlanModulesFromHash();
    if (fromUrl) {
      console.log('[ModulesContext] plan_modules from URL:', fromUrl);
      setPlanModules(fromUrl);
      // Persist to sessionStorage for SPA navigation
      sessionStorage.setItem('mesaclik_plan_modules', fromUrl);
      setIsLoading(false);
      return;
    }

    // 2. Try sessionStorage (persisted from previous URL capture)
    const fromSession = sessionStorage.getItem('mesaclik_plan_modules') as PlanModules | null;
    if (fromSession && ['FILA', 'RESERVA', 'FILA_RESERVA'].includes(fromSession)) {
      console.log('[ModulesContext] plan_modules from sessionStorage:', fromSession);
      setPlanModules(fromSession);
      setIsLoading(false);
      return;
    }

    // 3. Fallback: fetch from DB
    if (!restaurantId) {
      // Default to FILA_RESERVA in dev/preview
      const isPreview = import.meta.env.DEV || 
        window.location.hostname.includes('lovable.app') || 
        window.location.hostname === 'localhost';
      if (isPreview) {
        setPlanModules('FILA_RESERVA');
      }
      setIsLoading(false);
      return;
    }

    const fetchFromDB = async () => {
      try {
        const { data, error } = await (supabase as any)
          .schema('public')
          .from('restaurants')
          .select('plan_modules')
          .eq('id', restaurantId)
          .single();

        if (error) {
          console.error('[ModulesContext] Error fetching plan_modules:', error);
          setPlanModules('FILA_RESERVA'); // safe fallback
        } else {
          const pm = (data?.plan_modules || 'FILA_RESERVA').toUpperCase() as PlanModules;
          console.log('[ModulesContext] plan_modules from DB:', pm);
          setPlanModules(pm);
          sessionStorage.setItem('mesaclik_plan_modules', pm);
        }
      } catch (err) {
        console.error('[ModulesContext] Unexpected error:', err);
        setPlanModules('FILA_RESERVA');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFromDB();
  }, [restaurantId]);

  const hasModule = (mod: 'fila' | 'reserva'): boolean => {
    if (!planModules) return true; // loading fallback
    if (planModules === 'FILA_RESERVA') return true;
    if (mod === 'fila') return planModules === 'FILA';
    if (mod === 'reserva') return planModules === 'RESERVA';
    return false;
  };

  return (
    <ModulesContext.Provider value={{ planModules, hasModule, isLoading }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModulesContext);
  if (context === undefined) {
    // Safe fallback (outside provider)
    return {
      planModules: 'FILA_RESERVA' as PlanModules,
      hasModule: () => true,
      isLoading: false,
    };
  }
  return context;
}

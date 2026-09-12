import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { ModuleKey } from '@/config/modules';

export type PlanModules = 'FILA' | 'RESERVA' | 'FILA_RESERVA';

interface ModulesContextType {
  planModules: PlanModules | null;
  /** Lista de módulos contratados pelo restaurante. */
  modules: ModuleKey[];
  /** Verifica se um módulo está contratado. */
  hasModule: (mod: ModuleKey) => boolean;
  /** Retorna o primeiro módulo contratado que pode ser a tela inicial. */
  homeModule: ModuleKey | null;
  isLoading: boolean;
}

const ModulesContext = createContext<ModulesContextType | undefined>(undefined);

function parseModulesList(value: unknown): ModuleKey[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
      .filter(Boolean) as ModuleKey[];
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,;|]/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean) as ModuleKey[];
  }
  return [];
}

/**
 * Converte o campo legado plan_modules em uma lista de módulos.
 */
function legacyToModules(legacy: string | null): ModuleKey[] {
  const pm = (legacy || 'FILA_RESERVA').toUpperCase();
  if (pm === 'FILA') return ['fila'];
  if (pm === 'RESERVA') return ['reservas'];
  return ['fila', 'reservas'];
}

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { restaurantId, restaurant } = useRestaurant();
  const [planModules, setPlanModules] = useState<PlanModules | null>(null);
  const [modules, setModules] = useState<ModuleKey[]>(['fila', 'reservas']);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Se o restaurante já veio com plan_modules_list (Realtime/RestaurantContext),
    // usamos direto para evitar flicker.
    const listFromRestaurant = parseModulesList((restaurant as any)?.plan_modules_list);
    if (listFromRestaurant.length > 0) {
      setModules(listFromRestaurant);
    }
  }, [restaurant]);

  useEffect(() => {
    if (!restaurantId) {
      setIsLoading(false);
      return;
    }

    const fetchFromDB = async () => {
      try {
        const { data, error } = await (supabase as any)
          .schema('public')
          .from('restaurants')
          .select('plan_modules, plan_modules_list')
          .eq('id', restaurantId)
          .single();

        if (error) {
          console.error('[ModulesContext] Error fetching modules:', error);
          setPlanModules('FILA_RESERVA');
          setModules(['fila', 'reservas']);
        } else {
          const legacy = (data?.plan_modules || 'FILA_RESERVA').toUpperCase() as PlanModules;
          const list = parseModulesList(data?.plan_modules_list);
          const merged = list.length > 0 ? list : legacyToModules(legacy);
          setPlanModules(legacy);
          setModules(merged);
        }
      } catch (err) {
        console.error('[ModulesContext] Unexpected error:', err);
        setPlanModules('FILA_RESERVA');
        setModules(['fila', 'reservas']);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFromDB();
  }, [restaurantId]);

  const hasModule = (mod: ModuleKey): boolean => {
    if (isLoading) return true; // permissivo durante carregamento
    return modules.includes(mod);
  };

  const homeModule = ((): ModuleKey | null => {
    if (modules.includes('dashboard')) return 'dashboard';
    const candidate = modules.find((m) => m !== 'dashboard');
    return candidate || null;
  })();

  return (
    <ModulesContext.Provider value={{ planModules, modules, hasModule, homeModule, isLoading }}>
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
      modules: ['fila', 'reservas'] as ModuleKey[],
      hasModule: () => true,
      homeModule: 'fila' as ModuleKey,
      isLoading: false,
    };
  }
  return context;
}

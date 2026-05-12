import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { toast } from 'sonner';

export type DishCategory = 'entrada' | 'principal' | 'sobremesa' | 'bebida' | 'especial';
export type DishMargin = 'alta' | 'media' | 'baixa';

export interface MenuDish {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: DishCategory;
  ingredients: string[];
  profiles: string[];
  occasions: string[];
  margin: DishMargin;
  restrictions: string[];
  ai_notes: string | null;
  photo_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type DishInput = Omit<MenuDish, 'id' | 'restaurant_id' | 'created_at' | 'updated_at' | 'active'>;

export function useMenuDishes() {
  const { restaurantId } = useRestaurant();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['menu-dishes', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('menu_dishes')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MenuDish[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: DishInput) => {
      if (!restaurantId) throw new Error('Sem restaurante');
      const { error } = await (supabase as any)
        .from('menu_dishes')
        .insert({ ...input, restaurant_id: restaurantId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Prato adicionado ao cardápio');
      qc.invalidateQueries({ queryKey: ['menu-dishes'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar prato'),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<DishInput> & { id: string }) => {
      const { error } = await (supabase as any)
        .from('menu_dishes')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Prato atualizado');
      qc.invalidateQueries({ queryKey: ['menu-dishes'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao atualizar'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('menu_dishes')
        .update({ active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Prato removido');
      qc.invalidateQueries({ queryKey: ['menu-dishes'] });
    },
  });

  return { dishes: list.data ?? [], isLoading: list.isLoading, create, update, remove };
}

export async function uploadDishPhoto(file: File, restaurantId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${restaurantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('dish-photos').upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from('dish-photos').getPublicUrl(path).data.publicUrl;
}
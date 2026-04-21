import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { toast } from 'sonner';

export interface ChecklistCategory {
  id: string;
  restaurant_id: string;
  name: string;
  slug: string;
  icon: string;
  display_order: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  category_id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  is_critical: boolean;
  requires_photo: boolean;
  has_qr: boolean;
  scheduled_time: string | null;
  display_order: number;
  active: boolean;
  active_days: number[];
  created_at: string;
}

export interface ChecklistCompletion {
  id: string;
  item_id: string;
  restaurant_id: string;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string;
  completion_date: string;
  via_qr: boolean;
  photo_url: string | null;
  notes: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function useChecklistCategories() {
  const { restaurantId } = useRestaurant();

  return useQuery({
    queryKey: ['checklist-categories', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('checklist_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChecklistCategory[];
    },
  });
}

export function useChecklistItems() {
  const { restaurantId } = useRestaurant();

  return useQuery({
    queryKey: ['checklist-items', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('checklist_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });
}

export function useChecklistCompletionsToday() {
  const { restaurantId } = useRestaurant();

  return useQuery({
    queryKey: ['checklist-completions', restaurantId, today()],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('checklist_completions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('completion_date', today())
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChecklistCompletion[];
    },
  });
}

/**
 * Real-time subscription: invalidates queries when any checklist table changes
 * for the current restaurant. Replaces polling for instant Manager↔Team sync.
 */
export function useChecklistRealtime() {
  const { restaurantId } = useRestaurant();
  const qc = useQueryClient();

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`checklists-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_categories', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        qc.invalidateQueries({ queryKey: ['checklist-categories', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        qc.invalidateQueries({ queryKey: ['checklist-items', restaurantId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_completions', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        qc.invalidateQueries({ queryKey: ['checklist-completions', restaurantId, today()] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, qc]);
}

const DEFAULT_CATEGORIES = [
  { name: 'Abertura', slug: 'abertura', display_order: 1, icon: 'Sunrise' },
  { name: 'Fechamento', slug: 'fechamento', display_order: 2, icon: 'Moon' },
  { name: 'Higienização', slug: 'higienizacao', display_order: 3, icon: 'Sparkles' },
  { name: 'Temperatura', slug: 'temperatura', display_order: 4, icon: 'Thermometer' },
  { name: 'Recebimento', slug: 'recebimento', display_order: 5, icon: 'PackageCheck' },
];

export function useSeedDefaultCategories() {
  const { restaurantId } = useRestaurant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('Sem restaurante');
      const rows = DEFAULT_CATEGORIES.map((c) => ({ ...c, restaurant_id: restaurantId }));
      const { error } = await (supabase as any)
        .from('checklist_categories')
        .insert(rows);
      if (error && !String(error.message).includes('duplicate')) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist-categories'] }),
  });
}

export function useCreateCategory() {
  const { restaurantId } = useRestaurant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; icon: string }) => {
      if (!restaurantId) throw new Error('Sem restaurante');
      const slug = input.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
      const { error } = await (supabase as any)
        .from('checklist_categories')
        .insert({ restaurant_id: restaurantId, name: input.name, slug, icon: input.icon, display_order: 99 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Categoria criada');
      qc.invalidateQueries({ queryKey: ['checklist-categories'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao criar categoria'),
  });
}

export function useCreateItem() {
  const { restaurantId } = useRestaurant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      category_id: string;
      name: string;
      is_critical: boolean;
      requires_photo: boolean;
      has_qr: boolean;
      scheduled_time?: string | null;
      active_days?: number[];
    }) => {
      if (!restaurantId) throw new Error('Sem restaurante');
      const { error } = await (supabase as any)
        .from('checklist_items')
        .insert({
          restaurant_id: restaurantId,
          category_id: input.category_id,
          name: input.name,
          is_critical: input.is_critical,
          requires_photo: input.requires_photo,
          has_qr: input.has_qr,
          scheduled_time: input.scheduled_time || null,
          active_days: input.active_days ?? [0, 1, 2, 3, 4, 5, 6],
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item adicionado');
      qc.invalidateQueries({ queryKey: ['checklist-items'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao adicionar item'),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      is_critical?: boolean;
      requires_photo?: boolean;
      has_qr?: boolean;
      scheduled_time?: string | null;
      active_days?: number[];
    }) => {
      const { id, ...patch } = input;
      const { error } = await (supabase as any)
        .from('checklist_items')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item atualizado');
      qc.invalidateQueries({ queryKey: ['checklist-items'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao atualizar item'),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('checklist_items').update({ active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Item removido');
      qc.invalidateQueries({ queryKey: ['checklist-items'] });
    },
  });
}

export function useCompleteItem() {
  const { restaurantId, user } = useRestaurant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { item_id: string; via_qr: boolean; photo_url?: string | null; user_name?: string | null }) => {
      if (!restaurantId) throw new Error('Sem restaurante');
      const { error } = await (supabase as any)
        .from('checklist_completions')
        .insert({
          item_id: input.item_id,
          restaurant_id: restaurantId,
          completed_by: user?.id ?? null,
          completed_by_name: input.user_name ?? user?.email ?? 'Equipe',
          via_qr: input.via_qr,
          photo_url: input.photo_url ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist-completions'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao concluir item'),
  });
}

export async function uploadChecklistPhoto(file: File, restaurantId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${restaurantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('checklist-photos').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('checklist-photos').getPublicUrl(path);
  return data.publicUrl;
}

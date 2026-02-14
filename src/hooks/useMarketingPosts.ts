import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { toast } from 'sonner';

export interface MarketingPost {
  id: string;
  restaurant_id: string;
  user_id: string;
  type: string;
  format: string;
  headline: string;
  subtext: string | null;
  cta: string | null;
  template_id: string;
  image_url: string | null;
  created_at: string;
}

interface GeneratePostInput {
  type: string;
  format: 'square' | 'story';
  headline: string;
  subtext?: string;
  cta?: string;
  template_id?: string;
}

export function useMarketingPosts() {
  const { restaurantId, restaurant } = useRestaurant();
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: ['marketing-posts', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any)
        .from('marketing_posts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as MarketingPost[];
    },
    enabled: !!restaurantId,
  });

  const generateMutation = useMutation({
    mutationFn: async (input: GeneratePostInput) => {
      if (!restaurantId || !restaurant) throw new Error('Restaurante não encontrado');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      const response = await supabase.functions.invoke('generate-marketing-post', {
        body: {
          restaurant_id: restaurantId,
          restaurant_name: restaurant.name,
          cuisine: restaurant.cuisine,
          ...input,
        },
      });

      if (response.error) throw new Error(response.error.message || 'Erro ao gerar post');
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-posts', restaurantId] });
      toast.success('Post gerado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao gerar post');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await (supabase as any)
        .from('marketing_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-posts', restaurantId] });
      toast.success('Post removido');
    },
  });

  return {
    posts: postsQuery.data || [],
    isLoading: postsQuery.isLoading,
    generate: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    deletePost: deleteMutation.mutateAsync,
  };
}

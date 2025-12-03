import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { FEATURE_FLAGS, FEATURE_DISABLED_MESSAGE } from '@/config/feature-flags';

export type PublicationStatus = 'pending' | 'paid' | 'cancelled';

export type CouponPublication = {
  id: string;
  coupon_id: string;
  restaurant_id: string;
  start_at: string;
  end_at: string;
  duration_hours: number;
  price: number;
  status: PublicationStatus;
  invoice_url?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
};

export type CouponPricing = {
  id: string;
  duration_hours: number;
  price: number;
};

export type CreatePublicationParams = {
  coupon_id: string;
  start_at: string;
  end_at: string;
  duration_hours: number;
};

export function useCouponPublications() {
  const [publications, setPublications] = useState<CouponPublication[]>([]);
  const [pricing, setPricing] = useState<CouponPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Feature flag check
  const isFeatureEnabled = FEATURE_FLAGS.CUPONS_ENABLED;

  useEffect(() => {
    if (!isFeatureEnabled) {
      setLoading(false);
      setPublications([]);
      return;
    }
    fetchPublications();
    fetchPricing();
  }, [isFeatureEnabled]);

  const fetchPublications = async () => {
    if (!isFeatureEnabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('coupon_publications')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPublications(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar publicações';
      setError(message);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPricing = async () => {
    if (!isFeatureEnabled) return;

    try {
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('coupon_pricing')
        .select('*')
        .order('duration_hours', { ascending: true });

      if (error) throw error;
      setPricing(data || []);
    } catch (err) {
      console.error('Erro ao carregar preços:', err);
    }
  };

  const getPriceForDuration = (hours: number): number => {
    const priceEntry = pricing.find(p => p.duration_hours === hours);
    return priceEntry?.price || 0;
  };

  const createPublication = async (params: CreatePublicationParams) => {
    if (!isFeatureEnabled) {
      toast({
        title: 'Funcionalidade desativada',
        description: FEATURE_DISABLED_MESSAGE,
        variant: 'destructive',
      });
      throw new Error(FEATURE_DISABLED_MESSAGE);
    }

    try {
      const price = getPriceForDuration(params.duration_hours);

      const { data, error } = await supabase
        .schema('mesaclik')
        .from('coupon_publications')
        .insert([{
          ...params,
          restaurant_id: RESTAURANT_ID,
          price,
          status: 'pending' as PublicationStatus,
        }])
        .select()
        .single();

      if (error) throw error;

      // Atualizar status do cupom para "scheduled" ou "active"
      const now = new Date();
      const startAt = new Date(params.start_at);
      const newStatus = startAt <= now ? 'active' : 'scheduled';

      await supabase
        .schema('mesaclik')
        .from('coupons')
        .update({ status: newStatus })
        .eq('id', params.coupon_id);

      toast({
        title: 'Sucesso',
        description: 'Publicação criada. Aguardando pagamento.',
      });

      await fetchPublications();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar publicação';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updatePublicationStatus = async (id: string, status: PublicationStatus) => {
    if (!isFeatureEnabled) {
      toast({
        title: 'Funcionalidade desativada',
        description: FEATURE_DISABLED_MESSAGE,
        variant: 'destructive',
      });
      throw new Error(FEATURE_DISABLED_MESSAGE);
    }

    try {
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('coupon_publications')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Status atualizado com sucesso',
      });

      await fetchPublications();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const extendPublication = async (publicationId: string, additionalHours: number) => {
    if (!isFeatureEnabled) {
      toast({
        title: 'Funcionalidade desativada',
        description: FEATURE_DISABLED_MESSAGE,
        variant: 'destructive',
      });
      throw new Error(FEATURE_DISABLED_MESSAGE);
    }

    try {
      const publication = publications.find(p => p.id === publicationId);
      if (!publication) throw new Error('Publicação não encontrada');

      const newEndAt = new Date(publication.end_at);
      newEndAt.setHours(newEndAt.getHours() + additionalHours);

      const additionalPrice = getPriceForDuration(additionalHours);

      // Criar nova publicação para a extensão
      return await createPublication({
        coupon_id: publication.coupon_id,
        start_at: publication.end_at,
        end_at: newEndAt.toISOString(),
        duration_hours: additionalHours,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao estender publicação';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  return {
    publications,
    pricing,
    loading,
    error,
    refetch: fetchPublications,
    getPriceForDuration,
    createPublication,
    updatePublicationStatus,
    extendPublication,
  };
}

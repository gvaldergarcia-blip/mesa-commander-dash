import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export type ActiveCoupon = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  coupon_type: 'link' | 'upload';
  coupon_link: string | null;
  file_url: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  price: number;
  status: string;
  payment_status: string;
  created_at: string;
  views_count: number;
  clicks_count: number;
  uses_count: number;
  restaurant?: {
    name: string;
    image_url: string | null;
    cuisine: string;
    address: string | null;
    city: string | null;
  };
};

export function useActiveCoupons() {
  const [coupons, setCoupons] = useState<ActiveCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveCoupons = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString();
      
      console.log('[useActiveCoupons] Buscando cupons ativos...');
      
      // Query com schema explícito
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('coupons')
        .select(`
          *,
          restaurants!coupons_restaurant_id_fkey (
            name,
            image_url,
            cuisine,
            address,
            city
          )
        `)
        .eq('status', 'active')
        .eq('payment_status', 'completed')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useActiveCoupons] Erro ao buscar cupons:', error);
        throw error;
      }
      
      console.log('[useActiveCoupons] Cupons ativos encontrados:', data?.length || 0, data);
      
      // Mapear restaurant corretamente
      const mappedData = data?.map((coupon: any) => ({
        ...coupon,
        restaurant: coupon.restaurants
      })) || [];
      
      setCoupons(mappedData);
    } catch (error) {
      console.error('[useActiveCoupons] Error fetching active coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveCoupons();

    // Realtime subscription para novos cupons
    const channel = supabase
      .channel('coupons-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'coupons',
        },
        (payload) => {
          console.log('Mudança em cupons:', payload);
          fetchActiveCoupons();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const registerInteraction = async (couponId: string, interactionType: 'view' | 'click' | 'use') => {
    try {
      const { error } = await supabase
        .schema('mesaclik')
        .from('coupon_interactions')
        .insert([{
          coupon_id: couponId,
          interaction_type: interactionType,
          user_id: (await supabase.auth.getUser()).data.user?.id || null
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error registering interaction:', error);
    }
  };

  return {
    coupons,
    loading,
    registerInteraction,
    refetch: fetchActiveCoupons,
  };
}

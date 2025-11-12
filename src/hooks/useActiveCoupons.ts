import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ActiveCoupon = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  coupon_type: 'link' | 'upload';
  coupon_link: string | null;
  coupon_asset_url: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  price: number;
  status: string;
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
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('coupons' as any)
        .select(`
          *,
          restaurant:restaurant_id (
            name,
            image_url,
            cuisine,
            address,
            city
          )
        `)
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('end_date', { ascending: true });

      if (error) throw error;
      
      setCoupons((data as any) || []);
    } catch (error) {
      console.error('Error fetching active coupons:', error);
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
          filter: 'status=eq.active'
        },
        () => {
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
        .from('coupon_interactions' as any)
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

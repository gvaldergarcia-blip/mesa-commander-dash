import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export type ActiveCoupon = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  coupon_type: 'link' | 'upload';
  redeem_link: string | null;
  file_url: string | null;
  image_url: string | null;
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

export function useActiveCoupons(restaurantId?: string) {
  const [coupons, setCoupons] = useState<ActiveCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);

  const fetchActiveCoupons = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Usar data atual em UTC para comparação consistente com o banco
      const now = new Date();
      // Converter para início e fim do dia em UTC
      const todayStart = now.toISOString().split('T')[0] + 'T00:00:00.000Z';
      const todayEnd = now.toISOString().split('T')[0] + 'T23:59:59.999Z';
      
      console.log('[useActiveCoupons] =================================');
      console.log('[useActiveCoupons] Buscando cupons ativos...');
      console.log('[useActiveCoupons] Data atual UTC:', now.toISOString());
      console.log('[useActiveCoupons] Início do dia UTC:', todayStart);
      console.log('[useActiveCoupons] Fim do dia UTC:', todayEnd);
      console.log('[useActiveCoupons] Restaurant ID filtro:', restaurantId || 'todos');
      
      // Query sem join primeiro para simplificar debug
      const { data: rawData, error: rawError } = await (supabase as any)
        .schema('mesaclik')
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .eq('payment_status', 'completed');
      
      console.log('[useActiveCoupons] Todos cupons active+completed:', rawData?.length || 0, rawData);
      
      if (rawError) {
        console.error('[useActiveCoupons] Erro na query raw:', rawError);
      }
      
      // Query completa com filtro de datas
      let query = (supabase as any)
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
        .lte('start_date', todayEnd)
        .gte('end_date', todayStart)
        .order('end_date', { ascending: true });

      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId);
      }

      const { data, error: queryError } = await query;
      
      console.log('[useActiveCoupons] Query final resultado:', data?.length || 0);

      if (queryError) {
        console.error('[useActiveCoupons] Erro ao buscar cupons:', queryError);
        setError(queryError.message);
        setDebug({ error: queryError, todayStart, todayEnd, restaurantId });
        throw queryError;
      }
      
      console.log('[useActiveCoupons] Cupons ativos encontrados:', data?.length || 0);
      console.log('[useActiveCoupons] Dados:', data);
      
      // Mapear restaurant corretamente
      const mappedData = data?.map((coupon: any) => ({
        ...coupon,
        restaurant: coupon.restaurants
      })) || [];
      
      setDebug({ 
        count: mappedData.length, 
        todayStart, 
        todayEnd, 
        restaurantId,
        rawData: data 
      });
      
      setCoupons(mappedData);
    } catch (err) {
      console.error('[useActiveCoupons] Error fetching active coupons:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveCoupons();

    // Realtime subscription para mudanças em cupons
    const channel = supabase
      .channel('coupons-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'mesaclik',
          table: 'coupons',
        },
        (payload) => {
          console.log('[useActiveCoupons] Mudança detectada em cupons:', payload);
          fetchActiveCoupons();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const registerInteraction = async (couponId: string, interactionType: 'view' | 'click' | 'use') => {
    try {
      const { error } = await (supabase as any)
        .schema('mesaclik')
        .from('coupon_interactions')
        .insert([{
          coupon_id: couponId,
          interaction_type: interactionType,
          user_id: (await supabase.auth.getUser()).data.user?.id || null
        }]);

      if (error) {
        console.error('[useActiveCoupons] Erro ao registrar interação:', error);
      }
    } catch (error) {
      console.error('[useActiveCoupons] Error registering interaction:', error);
    }
  };

  return {
    coupons,
    loading,
    error,
    debug,
    registerInteraction,
    refetch: fetchActiveCoupons,
  };
}
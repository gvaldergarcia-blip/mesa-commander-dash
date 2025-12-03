import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FEATURE_FLAGS } from '@/config/feature-flags';

export type CouponAnalytics = {
  id: string;
  coupon_id: string;
  publication_id?: string;
  date: string;
  impressions: number;
  clicks: number;
  redemptions: number;
  created_at: string;
  updated_at: string;
};

export function useCouponAnalytics(couponId?: string) {
  const [analytics, setAnalytics] = useState<CouponAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Feature flag check
  const isFeatureEnabled = FEATURE_FLAGS.CUPONS_ENABLED;

  useEffect(() => {
    if (!isFeatureEnabled) {
      setLoading(false);
      setAnalytics([]);
      return;
    }
    if (couponId) {
      fetchAnalytics();
    }
  }, [couponId, isFeatureEnabled]);

  const fetchAnalytics = async () => {
    if (!couponId || !isFeatureEnabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .schema('mesaclik')
        .from('coupon_analytics')
        .select('*');

      if (couponId) {
        query = query.eq('coupon_id', couponId);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      setAnalytics(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar analytics';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const getTotalStats = () => {
    return analytics.reduce(
      (acc, curr) => ({
        impressions: acc.impressions + curr.impressions,
        clicks: acc.clicks + curr.clicks,
        redemptions: acc.redemptions + curr.redemptions,
      }),
      { impressions: 0, clicks: 0, redemptions: 0 }
    );
  };

  const getCTR = () => {
    const stats = getTotalStats();
    if (stats.impressions === 0) return 0;
    return ((stats.clicks / stats.impressions) * 100).toFixed(2);
  };

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics,
    getTotalStats,
    getCTR,
  };
}

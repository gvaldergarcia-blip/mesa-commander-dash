import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { FEATURE_FLAGS, FEATURE_DISABLED_MESSAGE } from '@/config/feature-flags';

export type DiscountType = 'percentage' | 'fixed';
export type CouponStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'cancelled';

export type Coupon = {
  id: string;
  restaurant_id: string;
  title: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  code?: string | null;
  redeem_link?: string | null;
  coupon_type?: 'link' | 'upload' | null;
  file_url?: string | null;
  image_url?: string | null;
  bg_color?: string | null;
  tags?: string[] | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  price: number;
  status: CouponStatus;
  payment_status?: 'pending' | 'completed' | 'failed' | 'refunded' | null;
  payment_method?: string | null;
  paid_at?: string | null;
  stripe_payment_id?: string | null;
  stripe_checkout_session_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  views_count?: number | null;
  clicks_count?: number | null;
  uses_count?: number | null;
  short_text?: string | null;
  discount_text?: string | null;
  is_paid?: boolean | null;
};

export type CreateCouponParams = Omit<Coupon, 'id' | 'created_at' | 'updated_at'>;
export type UpdateCouponParams = Partial<CreateCouponParams> & { id: string };

export function useCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Feature flag check - desabilita todas as operações de cupons
  const isFeatureEnabled = FEATURE_FLAGS.CUPONS_ENABLED;

  useEffect(() => {
    if (isFeatureEnabled) {
      fetchCoupons();
    } else {
      setLoading(false);
      setCoupons([]);
    }
  }, [isFeatureEnabled]);

  const fetchCoupons = async () => {
    // Se feature desabilitada, não faz nada
    if (!isFeatureEnabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('coupons')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar cupons';
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

  const createCoupon = async (coupon: CreateCouponParams) => {
    // Se feature desabilitada, bloqueia operação
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
        .from('coupons')
        .insert([coupon])
        .select()
        .single();

      if (error) throw error;

      // Log auditoria
      await logAudit(data.id, 'created', null);

      toast({
        title: 'Sucesso',
        description: 'Cupom criado com sucesso',
      });

      await fetchCoupons();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar cupom';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateCoupon = async ({ id, ...updates }: UpdateCouponParams) => {
    // Se feature desabilitada, bloqueia operação
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
        .from('coupons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log auditoria
      await logAudit(id, 'updated', updates);

      toast({
        title: 'Sucesso',
        description: 'Cupom atualizado com sucesso',
      });

      await fetchCoupons();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar cupom';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const deleteCoupon = async (id: string) => {
    // Se feature desabilitada, bloqueia operação
    if (!isFeatureEnabled) {
      toast({
        title: 'Funcionalidade desativada',
        description: FEATURE_DISABLED_MESSAGE,
        variant: 'destructive',
      });
      throw new Error(FEATURE_DISABLED_MESSAGE);
    }

    try {
      const { error } = await supabase
        .schema('mesaclik')
        .from('coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Cupom excluído com sucesso',
      });

      await fetchCoupons();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir cupom';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const duplicateCoupon = async (id: string) => {
    // Se feature desabilitada, bloqueia operação
    if (!isFeatureEnabled) {
      toast({
        title: 'Funcionalidade desativada',
        description: FEATURE_DISABLED_MESSAGE,
        variant: 'destructive',
      });
      throw new Error(FEATURE_DISABLED_MESSAGE);
    }

    try {
      const original = coupons.find(c => c.id === id);
      if (!original) throw new Error('Cupom não encontrado');

      const { id: _, created_at, updated_at, ...couponData } = original;
      
      return await createCoupon({
        ...couponData,
        title: `${couponData.title} (Cópia)`,
        status: 'draft',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao duplicar cupom';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      throw err;
    }
  };

  const logAudit = async (couponId: string, action: string, metadata: any) => {
    try {
      await supabase
        .schema('mesaclik')
        .from('coupon_audit_log')
        .insert([{
          coupon_id: couponId,
          action,
          metadata,
        }]);
    } catch (err) {
      console.error('Erro ao registrar auditoria:', err);
    }
  };

  return {
    coupons,
    loading,
    error,
    refetch: fetchCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    duplicateCoupon,
  };
}

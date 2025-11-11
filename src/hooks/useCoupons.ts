import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RESTAURANT_ID } from '@/config/current-restaurant';

export type DiscountType = 'percentage' | 'fixed';
export type CouponStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'cancelled';

export type Coupon = {
  id: string;
  restaurant_id: string;
  title: string;
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  code?: string;
  redeem_link?: string;
  image_url?: string;
  bg_color?: string;
  tags?: string[];
  start_date: string;
  end_date: string;
  duration_days: number;
  price: number;
  status: CouponStatus;
  stripe_payment_id?: string;
  stripe_checkout_session_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type CreateCouponParams = Omit<Coupon, 'id' | 'created_at' | 'updated_at'>;
export type UpdateCouponParams = Partial<CreateCouponParams> & { id: string };

export function useCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
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

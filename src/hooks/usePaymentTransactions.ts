import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';

export type PaymentTransaction = {
  id: string;
  restaurant_id: string;
  coupon_id: string | null;
  transaction_code: string;
  payment_method: 'pix' | 'credit' | 'debit' | 'other';
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  pix_code: string | null;
  payment_provider: string | null;
  provider_transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
};

export function usePaymentTransactions() {
  const { restaurantId } = useRestaurant();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_transactions' as any)
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTransactions((data as any) || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (restaurantId) fetchTransactions();
  }, [restaurantId]);

  const createTransaction = async (transaction: Omit<PaymentTransaction, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('payment_transactions' as any)
      .insert([transaction as any])
      .select()
      .single();
    if (error) throw error;
    await fetchTransactions();
    return data;
  };

  const updateTransactionStatus = async (transactionId: string, status: PaymentTransaction['status'], paidAt?: string) => {
    const updateData: any = { status };
    if (paidAt) updateData.paid_at = paidAt;
    const { error } = await supabase
      .from('payment_transactions' as any)
      .update(updateData)
      .eq('id', transactionId);
    if (error) throw error;
    await fetchTransactions();
  };

  return { transactions, loading, createTransaction, updateTransactionStatus, refetch: fetchTransactions };
}
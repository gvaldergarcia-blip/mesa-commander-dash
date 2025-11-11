import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';

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
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('payment_transactions')
        .select('*')
        .eq('restaurant_id', RESTAURANT_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data as any || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const createTransaction = async (transaction: Omit<PaymentTransaction, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .schema('mesaclik')
        .from('payment_transactions')
        .insert([transaction as any])
        .select()
        .single();

      if (error) throw error;
      
      await fetchTransactions();
      return data;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  };

  const updateTransactionStatus = async (transactionId: string, status: PaymentTransaction['status'], paidAt?: string) => {
    try {
      const updateData: any = { status };
      if (paidAt) updateData.paid_at = paidAt;

      const { error } = await supabase
        .schema('mesaclik')
        .from('payment_transactions')
        .update(updateData)
        .eq('id', transactionId);

      if (error) throw error;
      
      await fetchTransactions();
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  };

  return {
    transactions,
    loading,
    createTransaction,
    updateTransactionStatus,
    refetch: fetchTransactions,
  };
}

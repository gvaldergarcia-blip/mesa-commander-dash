/**
 * REGRA OFICIAL VIP - MESA CLIK
 * 
 * Um cliente é considerado VIP quando:
 * total_visits >= 10
 * 
 * Onde:
 * total_visits = queue_completed + reservations_completed
 * 
 * FONTE OFICIAL: tabela customers
 * Esta função busca o status VIP DIRETO da tabela customers
 */

import { supabase } from '@/lib/supabase/client';

export type CustomerVipStatus = {
  isVip: boolean;
  queueCompleted: number;
  reservationsCompleted: number;
  totalVisitsCompleted: number;
};

/**
 * Busca o status VIP de um cliente da tabela customers (FONTE OFICIAL)
 * @param phone - Telefone do cliente
 * @param restaurantId - ID do restaurante (opcional, usa RESTAURANT_ID por padrão)
 * @returns Status VIP com contadores detalhados
 */
export async function getCustomerVipStatus(phone: string): Promise<CustomerVipStatus> {
  try {
    // BUSCAR DIRETO DA TABELA CUSTOMERS (fonte oficial)
    // Nota: public.customers não tem restaurant_id, busca apenas por phone
    const { data: customer, error } = await supabase
      .from('customers')
      .select('vip_status, queue_completed, reservations_completed, total_visits')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;

    // Se cliente não existe na tabela customers, NÃO é VIP
    if (!customer) {
      return {
        isVip: false,
        queueCompleted: 0,
        reservationsCompleted: 0,
        totalVisitsCompleted: 0,
      };
    }

    // Usar dados da tabela customers
    const queueCompleted = customer.queue_completed || 0;
    const reservationsCompleted = customer.reservations_completed || 0;
    const totalVisitsCompleted = customer.total_visits || 0;

    // REGRA VIP: vip_status OU total_visits >= 10
    const isVip = customer.vip_status || totalVisitsCompleted >= 10;

    return {
      isVip,
      queueCompleted,
      reservationsCompleted,
      totalVisitsCompleted,
    };
  } catch (error) {
    console.error('Erro ao buscar status VIP do cliente:', error);
    return {
      isVip: false,
      queueCompleted: 0,
      reservationsCompleted: 0,
      totalVisitsCompleted: 0,
    };
  }
}

/**
 * Versão simplificada que retorna apenas o boolean
 * @param phone - Telefone do cliente
 * @returns true se cliente é VIP, false caso contrário
 */
export async function isVip(phone: string): Promise<boolean> {
  const status = await getCustomerVipStatus(phone);
  return status.isVip;
}

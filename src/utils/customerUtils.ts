/**
 * REGRA OFICIAL VIP - MESA CLIK
 * 
 * Um cliente é considerado VIP quando:
 * visits_completed >= 10
 * 
 * Onde:
 * visits_completed = fila_concluida + reservas_concluidas
 * 
 * Esta função calcula se um cliente é VIP baseado nos dados do Supabase
 */

import { supabase } from '@/lib/supabase/client';

export type CustomerVipStatus = {
  isVip: boolean;
  queueCompleted: number;
  reservationsCompleted: number;
  totalVisitsCompleted: number;
};

/**
 * Calcula o status VIP de um cliente baseado no telefone
 * @param phone - Telefone do cliente
 * @returns Status VIP com contadores detalhados
 */
export async function getCustomerVipStatus(phone: string): Promise<CustomerVipStatus> {
  try {
    // Contar fila concluída (status = 'seated')
    const { count: queueCount } = await supabase
      .schema('mesaclik')
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('status', 'seated');

    // Contar reservas concluídas (status = 'completed')
    const { count: reservationCount } = await supabase
      .schema('mesaclik')
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('status', 'completed');

    const queueCompleted = queueCount || 0;
    const reservationsCompleted = reservationCount || 0;
    const totalVisitsCompleted = queueCompleted + reservationsCompleted;

    // REGRA VIP: >= 10 visitas concluídas
    const isVip = totalVisitsCompleted >= 10;

    return {
      isVip,
      queueCompleted,
      reservationsCompleted,
      totalVisitsCompleted,
    };
  } catch (error) {
    console.error('Erro ao calcular status VIP:', error);
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

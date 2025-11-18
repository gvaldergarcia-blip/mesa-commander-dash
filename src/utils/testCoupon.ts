import { supabase } from '@/lib/supabase/client';

export async function createTestCoupon() {
  const restaurantId = 'b01b96fb-bd8c-46d6-b168-b4d11ffdd208';
  
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  
  const { data, error } = await supabase
    .schema('mesaclik')
    .from('coupons')
    .insert({
      restaurant_id: restaurantId,
      title: 'Cupom de Teste - 20% OFF',
      description: 'Teste de exibição no app',
      discount_type: 'percentage',
      discount_value: 20,
      code: 'TESTE20',
      coupon_type: 'link',
      redeem_link: 'https://example.com/cupom',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      duration_days: 7,
      price: 14,
      status: 'active',
      payment_status: 'completed',
      payment_method: 'test',
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();
    
  if (error) {
    console.error('Erro ao criar cupom de teste:', error);
    throw error;
  }
  
  console.log('Cupom de teste criado:', data);
  return data;
}

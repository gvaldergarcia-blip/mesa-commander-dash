import { supabase } from '@/lib/supabase/client';

export async function addToQueue(data: {
  restaurant_id: string;
  customer_name: string;
  phone: string;
  party_size: number;
  priority?: 'normal' | 'high' | 'vip';
  notes?: string;
}) {
  // Get current max position for waiting entries
  const { data: queueData } = await supabase
    .from('queue_entries')
    .select('position_number')
    .eq('restaurant_id', data.restaurant_id)
    .eq('status', 'waiting')
    .order('position_number', { ascending: false })
    .limit(1);

  const nextPosition = queueData && queueData.length > 0 
    ? (queueData[0].position_number || 0) + 1 
    : 1;

  const { data: newEntry, error } = await supabase
    .from('queue_entries')
    .insert({
      ...data,
      position_number: nextPosition,
      status: 'waiting',
      priority: data.priority || 'normal',
    })
    .select()
    .single();

  if (error) throw error;
  return newEntry;
}

export async function callQueue(id: string) {
  const { error } = await supabase
    .from('queue_entries')
    .update({
      status: 'called',
      called_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function seatQueue(id: string) {
  const { data: entry } = await supabase
    .from('queue_entries')
    .select('customer_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('queue_entries')
    .update({
      status: 'seated',
      seated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;

  // Update customer stats if customer_id exists
  if (entry?.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('total_visits')
      .eq('id', entry.customer_id)
      .single();

    if (customer) {
      await supabase
        .from('customers')
        .update({
          total_visits: customer.total_visits + 1,
          last_visit_date: new Date().toISOString(),
        })
        .eq('id', entry.customer_id);
    }
  }
}

export async function cancelQueue(id: string) {
  const { error } = await supabase
    .from('queue_entries')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function noShowQueue(id: string) {
  const { error } = await supabase
    .from('queue_entries')
    .update({
      status: 'no_show',
      canceled_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

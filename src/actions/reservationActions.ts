import { supabase } from '@/lib/supabase/client';

export async function createReservation(data: {
  restaurant_id: string;
  customer_name: string;
  phone: string;
  date: string;
  time: string;
  party_size: number;
  notes?: string;
}) {
  const datetime = `${data.date}T${data.time}:00`;

  const { data: reservation, error } = await supabase
    .from('reservations')
    .insert({
      restaurant_id: data.restaurant_id,
      customer_name: data.customer_name,
      phone: data.phone,
      reservation_datetime: datetime,
      party_size: data.party_size,
      notes: data.notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return reservation;
}

export async function confirmReservation(id: string) {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'confirmed' })
    .eq('id', id);

  if (error) throw error;
}

export async function seatReservation(id: string) {
  const { data: reservation } = await supabase
    .from('reservations')
    .select('customer_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'seated' })
    .eq('id', id);

  if (error) throw error;

  // Update customer stats if customer_id exists
  if (reservation?.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('total_visits')
      .eq('id', reservation.customer_id)
      .single();

    if (customer) {
      await supabase
        .from('customers')
        .update({
          total_visits: customer.total_visits + 1,
          last_visit_date: new Date().toISOString(),
        })
        .eq('id', reservation.customer_id);
    }
  }
}

export async function cancelReservation(id: string) {
  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function noShowReservation(id: string) {
  const { error } = await supabase
    .from('reservations')
    .update({
      status: 'no_show',
      canceled_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

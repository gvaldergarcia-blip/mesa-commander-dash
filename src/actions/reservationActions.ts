import { supabase } from '@/lib/supabase/client';
import { RESTAURANT_ID } from '@/config/current-restaurant';

export async function createReservation(data: {
  customer_name: string;
  phone: string;
  date: string;
  time: string;
  party_size: number;
  notes?: string;
}) {
  const datetime = `${data.date}T${data.time}:00`;

  const { data: reservation, error } = await supabase
    .schema('mesaclik')
    .from('reservations')
    .insert({
      restaurant_id: RESTAURANT_ID,
      user_id: RESTAURANT_ID, // Using restaurant ID as user_id for admin panel
      name: data.customer_name,
      phone: data.phone,
      reserved_for: datetime,
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
    .schema('mesaclik')
    .from('reservations')
    .update({ 
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

export async function seatReservation(id: string) {
  const { error } = await supabase
    .schema('mesaclik')
    .from('reservations')
    .update({ status: 'seated' })
    .eq('id', id);

  if (error) throw error;
}

export async function cancelReservation(id: string) {
  const { error } = await supabase
    .schema('mesaclik')
    .from('reservations')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      canceled_by: 'admin',
    })
    .eq('id', id);

  if (error) throw error;
}

export async function noShowReservation(id: string) {
  const { error } = await supabase
    .schema('mesaclik')
    .from('reservations')
    .update({
      status: 'no_show',
      no_show_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// Adapters para mapear nomes de campos do banco para a interface esperada

export type QueueEntryDB = {
  id: string;
  restaurant_id: string;
  customer_id?: string;
  party_size: number;
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show';
  position_number?: number;
  estimated_wait_time?: number;
  created_at: string;
  called_at?: string;
  seated_at?: string;
  canceled_at?: string;
  notes?: string;
  priority: 'normal' | 'high' | 'vip';
  customer_name: string;
  phone: string;
};

export type QueueEntry = {
  id: string;
  restaurant_id: string;
  customer_id?: string;
  party_size: number;
  status: 'waiting' | 'called' | 'seated' | 'canceled' | 'no_show';
  position: number;
  wait_eta_min?: number;
  created_at: string;
  called_at?: string;
  seated_at?: string;
  canceled_at?: string;
  notes?: string;
  priority: 'normal' | 'high' | 'vip';
  customer_name: string;
  phone: string;
};

export function adaptQueueEntry(entry: QueueEntryDB): QueueEntry {
  return {
    ...entry,
    position: entry.position_number || 0,
    wait_eta_min: entry.estimated_wait_time,
  };
}

export type ReservationDB = {
  id: string;
  restaurant_id: string;
  customer_id?: string;
  reservation_datetime: string;
  party_size: number;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show';
  notes?: string;
  created_at: string;
  customer_name: string;
  phone: string;
  canceled_at?: string;
  canceled_by?: string;
  cancel_reason?: string;
};

export type Reservation = {
  id: string;
  restaurant_id: string;
  customer_id?: string;
  date: string;
  time: string;
  party_size: number;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show';
  notes?: string;
  created_at: string;
  customer_name: string;
  phone: string;
};

export function adaptReservation(reservation: ReservationDB): Reservation {
  const datetime = new Date(reservation.reservation_datetime);
  return {
    ...reservation,
    date: datetime.toISOString().split('T')[0],
    time: datetime.toTimeString().slice(0, 5),
  };
}

export type CustomerDB = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  marketing_opt_in: boolean;
  total_visits: number;
  total_spent: number;
  last_visit_date?: string;
  notes?: string;
  vip_status: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  opt_in_email: boolean;
  visits_count: number;
  lifetime_value_cents: number;
  last_visit_at?: string;
  tags: string[];
  vip_status: boolean;
};

export function adaptCustomer(customer: CustomerDB): Customer {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    opt_in_email: customer.marketing_opt_in,
    visits_count: customer.total_visits,
    lifetime_value_cents: Math.round(customer.total_spent * 100),
    last_visit_at: customer.last_visit_date,
    tags: customer.vip_status ? ['VIP'] : [],
    vip_status: customer.vip_status,
  };
}

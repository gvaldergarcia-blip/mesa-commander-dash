import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customer_id, restaurant_id } = await req.json();

    if (!customer_id || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id and restaurant_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get customer data from restaurant_customers
    const { data: customer, error: customerError } = await supabase
      .from('restaurant_customers')
      .select('*')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found', details: customerError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = customer.customer_email?.toLowerCase().trim() || null;
    const phone = customer.customer_phone && customer.customer_phone !== '—' 
      ? customer.customer_phone.trim() 
      : null;

    console.log('[get-customer-history] Looking up history for:', { email, phone, restaurant_id });

    // 2. Get queue entries from mesaclik.queue_entries
    // The table has: name, phone, email, queue_id -> queues.restaurant_id
    const queueHistory: any[] = [];
    
    if (email) {
      // Query mesaclik.queue_entries by email (primary identifier for this customer)
      const { data: queueData, error: queueError } = await supabase
        .rpc('get_customer_queue_history', {
          p_restaurant_id: restaurant_id,
          p_email: email,
        });
      
      if (queueError) {
        console.error('[get-customer-history] Queue RPC error:', queueError);
        // Fallback: direct query on mesaclik schema
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('queue_entries')
          .select('id, created_at, called_at, seated_at, canceled_at, party_size, status, phone, name, email, queue_id')
          .order('created_at', { ascending: false })
          .limit(500);

        if (!fallbackError && fallbackData) {
          // Filter by email in memory since we can't easily filter by restaurant in fallback
          fallbackData
            .filter((q: any) => q.email?.toLowerCase() === email.toLowerCase())
            .forEach((q: any) => {
              queueHistory.push({
                id: q.id,
                type: 'queue',
                date: q.seated_at || q.canceled_at || q.called_at || q.created_at,
                party_size: q.party_size,
                status: q.status,
                created_at: q.created_at,
              });
            });
        }
      } else if (queueData) {
        queueData.forEach((q: any) => {
          queueHistory.push({
            id: q.id,
            type: 'queue',
            date: q.seated_at || q.canceled_at || q.called_at || q.created_at,
            party_size: q.party_size,
            status: q.status,
            created_at: q.created_at,
          });
        });
      }
    }

    console.log('[get-customer-history] Queue entries found:', queueHistory.length);

    // 3. Get reservations from mesaclik.reservations
    const reservationHistory: any[] = [];
    
    if (phone) {
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('id, reservation_datetime, party_size, status, created_at, phone, customer_name')
        .eq('restaurant_id', restaurant_id)
        .eq('phone', phone)
        .order('reservation_datetime', { ascending: false })
        .limit(500);

      if (reservationError) {
        console.error('[get-customer-history] Reservation query error:', reservationError);
      } else if (reservationData) {
        reservationData.forEach((r: any) => {
          reservationHistory.push({
            id: r.id,
            type: 'reservation',
            date: r.reservation_datetime,
            party_size: r.party_size,
            status: r.status,
            created_at: r.created_at,
          });
        });
      }
    }

    console.log('[get-customer-history] Reservations found:', reservationHistory.length);

    // 4. Get email logs / promotions
    const promotionHistory: any[] = [];
    
    if (email) {
      const { data: emailData, error: emailError } = await supabase
        .from('email_logs')
        .select('id, created_at, subject, status')
        .eq('restaurant_id', restaurant_id)
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(50);

      if (emailError) {
        console.error('[get-customer-history] Email logs query error:', emailError);
      } else if (emailData) {
        emailData.forEach((e: any) => {
          promotionHistory.push({
            id: e.id,
            date: e.created_at,
            subject: e.subject,
            status: e.status,
          });
        });
      }
    }

    console.log('[get-customer-history] Promotions found:', promotionHistory.length);

    // 5. Combine and sort all history
    const allHistory = [...queueHistory, ...reservationHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // 6. Build response
    const response = {
      customer: {
        id: customer.id,
        name: customer.customer_name,
        email: customer.customer_email,
        phone: customer.customer_phone,
        total_visits: customer.total_visits || (customer.total_queue_visits + customer.total_reservation_visits),
        queue_completed: customer.total_queue_visits,
        reservations_completed: customer.total_reservation_visits,
        vip: customer.vip,
        marketing_optin: customer.marketing_optin,
        created_at: customer.created_at,
        last_seen_at: customer.last_seen_at,
      },
      history: allHistory,
      promotions: promotionHistory,
      summary: {
        total_queue_entries: queueHistory.length,
        total_reservations: reservationHistory.length,
        total_promotions: promotionHistory.length,
        queue_seated: queueHistory.filter(q => q.status === 'seated').length,
        queue_canceled: queueHistory.filter(q => q.status === 'canceled' || q.status === 'no_show').length,
        reservations_completed: reservationHistory.filter(r => r.status === 'completed' || r.status === 'confirmed').length,
        reservations_canceled: reservationHistory.filter(r => r.status === 'canceled').length,
      },
    };

    console.log('[get-customer-history] Response summary:', response.summary);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[get-customer-history] Error:', errMsg);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

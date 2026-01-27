import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { customer_id, restaurant_id, email, phone } = await req.json();

    console.log('[get-customer-history] Request:', { customer_id, restaurant_id, email, phone });

    if (!restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'restaurant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get customer info from restaurant_customers
    let customerData = null;
    let customerEmail = email;
    let customerPhone = phone;

    if (customer_id) {
      const { data: rcData } = await supabase
        .from('restaurant_customers')
        .select('*')
        .eq('id', customer_id)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle();
      
      if (rcData) {
        customerData = rcData;
        customerEmail = rcData.customer_email;
        customerPhone = rcData.customer_phone !== '—' ? rcData.customer_phone : null;
      }
    }

    console.log('[get-customer-history] Customer:', { customerEmail, customerPhone });

    if (!customerEmail && !customerPhone) {
      return new Response(
        JSON.stringify({ 
          error: 'Customer not found or no identifiable data',
          customer: null,
          queue_history: [],
          reservation_history: [],
          promotion_history: [],
          metrics: null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch queue history from mesaclik.queue_entries
    // Need to join with mesaclik.queues to filter by restaurant_id
    const { data: queueHistory, error: queueError } = await supabase
      .rpc('get_customer_queue_history', {
        p_restaurant_id: restaurant_id,
        p_email: customerEmail || '',
        p_phone: customerPhone || ''
      });

    if (queueError) {
      console.log('[get-customer-history] Queue RPC not found, using direct query');
    }

    // Direct SQL query as fallback using mesaclik schema
    let queueData: any[] = [];
    let reservationData: any[] = [];

    // Query mesaclik.queue_entries via raw SQL through RPC or view
    // Since we can't directly query mesaclik from Edge Functions easily,
    // we'll query the public tables that might have synced data
    // OR use a dedicated RPC function

    // Try querying through the existing RPC that already works
    const { data: queueRaw } = await supabase
      .rpc('get_reports_queue_data', {
        p_restaurant_id: restaurant_id,
        p_start_date: '2020-01-01',
        p_end_date: '2030-12-31'
      });

    if (queueRaw) {
      // Filter by email or phone
      queueData = queueRaw.filter((q: any) => {
        if (customerEmail && q.email === customerEmail) return true;
        if (customerPhone && customerPhone !== '—' && q.phone === customerPhone) return true;
        return false;
      }).map((q: any) => ({
        id: q.id,
        type: 'queue',
        name: q.name || 'Cliente',
        date: q.seated_at || q.created_at,
        party_size: q.party_size,
        status: q.status,
        wait_time: q.wait_time_min,
        created_at: q.created_at,
        seated_at: q.seated_at,
        canceled_at: q.canceled_at
      }));
    }

    console.log('[get-customer-history] Queue data found:', queueData.length);

    // 3. Fetch reservation history
    const { data: reservationRaw } = await supabase
      .rpc('get_reports_reservation_data', {
        p_restaurant_id: restaurant_id,
        p_start_date: '2020-01-01',
        p_end_date: '2030-12-31'
      });

    if (reservationRaw) {
      reservationData = reservationRaw.filter((r: any) => {
        if (customerEmail && r.customer_email === customerEmail) return true;
        if (customerPhone && customerPhone !== '—' && r.phone === customerPhone) return true;
        return false;
      }).map((r: any) => ({
        id: r.id,
        type: 'reservation',
        name: r.name || 'Cliente',
        date: r.reserved_for,
        party_size: r.party_size,
        status: r.status,
        created_at: r.created_at,
        confirmed_at: r.confirmed_at,
        completed_at: r.completed_at,
        canceled_at: r.canceled_at
      }));
    }

    console.log('[get-customer-history] Reservation data found:', reservationData.length);

    // 4. Fetch promotion history (email_logs)
    let promotionHistory: any[] = [];
    
    // Build email query - email_logs uses 'email' column
    if (customerEmail) {
      const { data: emailLogs } = await supabase
        .from('email_logs')
        .select('id, email, subject, source, status, created_at, coupon_code, sent_at')
        .eq('restaurant_id', restaurant_id)
        .eq('email', customerEmail)
        .order('created_at', { ascending: false })
        .limit(50);

      if (emailLogs) {
        promotionHistory = emailLogs.map((e: any) => ({
          id: e.id,
          type: 'promotion',
          email: e.email,
          subject: e.subject,
          source: e.source,
          status: e.status,
          coupon_code: e.coupon_code,
          sent_at: e.sent_at,
          created_at: e.created_at
        }));
      }
    }

    console.log('[get-customer-history] Promotion data found:', promotionHistory.length);

    // 5. Calculate metrics
    const allVisits = [...queueData, ...reservationData];
    const completedVisits = allVisits.filter(v => 
      v.status === 'seated' || v.status === 'completed'
    );
    const canceledVisits = allVisits.filter(v => v.status === 'canceled');
    const noShowVisits = allVisits.filter(v => v.status === 'no_show');

    // Calculate average party size
    const avgPartySize = completedVisits.length > 0
      ? Math.round(completedVisits.reduce((acc, v) => acc + (v.party_size || 0), 0) / completedVisits.length)
      : 0;

    // Calculate preferred time (most common hour)
    const hours = completedVisits
      .filter(v => v.date)
      .map(v => new Date(v.date).getHours());
    
    const hourCounts: Record<number, number> = {};
    hours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    
    const mostFrequentHour = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    const preferredTime = mostFrequentHour 
      ? `${mostFrequentHour[0]}:00`
      : null;

    // Calculate show rate
    const totalWithOutcome = completedVisits.length + noShowVisits.length;
    const showRate = totalWithOutcome > 0
      ? Math.round((completedVisits.length / totalWithOutcome) * 100)
      : 100;

    // Preferred channel
    const queueCount = queueData.filter(q => q.status === 'seated').length;
    const reservationCount = reservationData.filter(r => r.status === 'completed').length;
    const preferredChannel = queueCount >= reservationCount ? 'queue' : 'reservation';

    // Monthly evolution (last 12 months)
    const monthlyEvolution: { month: string; queue: number; reservation: number }[] = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7); // YYYY-MM
      
      const queueInMonth = queueData.filter(q => {
        if (!q.date) return false;
        return q.date.startsWith(monthKey) && q.status === 'seated';
      }).length;
      
      const reservationInMonth = reservationData.filter(r => {
        if (!r.date) return false;
        return r.date.startsWith(monthKey) && r.status === 'completed';
      }).length;
      
      monthlyEvolution.push({
        month: monthDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        queue: queueInMonth,
        reservation: reservationInMonth
      });
    }

    const metrics = {
      total_visits: completedVisits.length,
      queue_completed: queueData.filter(q => q.status === 'seated').length,
      reservations_completed: reservationData.filter(r => r.status === 'completed').length,
      canceled_count: canceledVisits.length,
      no_show_count: noShowVisits.length,
      promotions_sent: promotionHistory.length,
      avg_party_size: avgPartySize,
      preferred_time: preferredTime,
      preferred_channel: preferredChannel,
      show_rate: showRate,
      monthly_evolution: monthlyEvolution
    };

    console.log('[get-customer-history] Metrics:', metrics);

    // Combine and sort all history by date
    const allHistory = [
      ...queueData,
      ...reservationData,
      ...promotionHistory.map(p => ({
        ...p,
        date: p.created_at,
        type: 'promotion' as const
      }))
    ].sort((a, b) => {
      const dateA = new Date(a.date || a.created_at || 0).getTime();
      const dateB = new Date(b.date || b.created_at || 0).getTime();
      return dateB - dateA; // Most recent first
    });

    return new Response(
      JSON.stringify({
        customer: customerData,
        queue_history: queueData,
        reservation_history: reservationData,
        promotion_history: promotionHistory,
        all_history: allHistory,
        metrics
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[get-customer-history] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

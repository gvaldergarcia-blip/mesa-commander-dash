import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { customer_id, restaurant_id, email, phone } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: 'restaurant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get customer info
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

    if (!customerEmail && !customerPhone) {
      return new Response(JSON.stringify({
        customer: null, queue_history: [], reservation_history: [],
        promotion_history: [], metrics: null, alerts: [], score: null, trend: null,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Fetch queue history
    const { data: queueRaw } = await supabase.rpc('get_customer_queue_history', {
      p_restaurant_id: restaurant_id,
      p_email: customerEmail || '',
      p_phone: customerPhone || ''
    });

    const queueData = (queueRaw || []).map((q: any) => ({
      id: q.id, type: 'queue',
      name: q.name || 'Cliente', email: q.email, phone: q.phone,
      date: q.seated_at || q.created_at, party_size: q.party_size,
      status: q.status, wait_time: q.wait_time_min,
      created_at: q.created_at, called_at: q.called_at,
      seated_at: q.seated_at, canceled_at: q.canceled_at,
      cancel_actor: q.canceled_at ? 'cliente' : null, // queue cancels are always by client in current system
    }));

    // 3. Fetch reservation history
    const { data: reservationRaw } = await supabase.rpc('get_customer_reservation_history', {
      p_restaurant_id: restaurant_id,
      p_email: customerEmail || '',
      p_phone: customerPhone || ''
    });

    const reservationData = (reservationRaw || []).map((r: any) => ({
      id: r.id, type: 'reservation',
      name: r.name || 'Cliente', email: r.customer_email, phone: r.phone,
      date: r.reserved_for, party_size: r.party_size,
      status: r.status, created_at: r.created_at, reserved_for: r.reserved_for,
      confirmed_at: r.confirmed_at, completed_at: r.completed_at,
      canceled_at: r.canceled_at, no_show_at: r.no_show_at,
      cancel_actor: r.canceled_by || (r.canceled_at ? 'desconhecido' : null),
    }));

    // 4. Fetch promotion history
    let promotionHistory: any[] = [];
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
          id: e.id, type: 'promotion', email: e.email, subject: e.subject,
          source: e.source, status: e.status, coupon_code: e.coupon_code,
          sent_at: e.sent_at, created_at: e.created_at, date: e.created_at,
        }));
      }
    }

    // 5. Fetch restaurant average wait time for comparison
    const { data: allQueueEntries } = await supabase.rpc('get_customer_queue_history', {
      p_restaurant_id: restaurant_id,
      p_email: '', p_phone: ''
    }).limit(500);
    
    // Actually let's query queue_entries directly for restaurant avg
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentQueues } = await supabase
      .from('queue_entries')
      .select('created_at, seated_at, queue_id')
      .eq('status', 'seated')
      .gte('created_at', ninetyDaysAgo)
      .limit(1000);
    
    // Filter by restaurant (queue_entries -> queues -> restaurant_id)
    const { data: restaurantQueues } = await supabase
      .from('queues')
      .select('id')
      .eq('restaurant_id', restaurant_id);
    
    const restaurantQueueIds = new Set((restaurantQueues || []).map((q: any) => q.id));
    const restaurantQueueEntries = (recentQueues || []).filter((e: any) => restaurantQueueIds.has(e.queue_id));
    
    let restaurantAvgWaitTime = 0;
    if (restaurantQueueEntries.length > 0) {
      const waitTimes = restaurantQueueEntries
        .filter((e: any) => e.seated_at && e.created_at)
        .map((e: any) => {
          const diff = new Date(e.seated_at).getTime() - new Date(e.created_at).getTime();
          return Math.round(diff / 60000);
        })
        .filter((w: number) => w > 0 && w < 300);
      
      if (waitTimes.length > 0) {
        restaurantAvgWaitTime = Math.round(waitTimes.reduce((a: number, b: number) => a + b, 0) / waitTimes.length);
      }
    }

    // 6. Calculate comprehensive metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgoDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const allVisits = [...queueData, ...reservationData];
    const completedVisits = allVisits.filter((v: any) => v.status === 'seated' || v.status === 'completed');
    const canceledVisits = allVisits.filter((v: any) => v.status === 'canceled');
    const noShowVisits = allVisits.filter((v: any) => v.status === 'no_show');
    
    // Cancellations by restaurant in last 30 days
    const recentCancelsByRestaurant = allVisits.filter((v: any) => {
      if (v.status !== 'canceled') return false;
      const cancelDate = new Date(v.canceled_at || v.date || v.created_at);
      if (cancelDate < thirtyDaysAgo) return false;
      // For reservations, canceled_by contains the actor
      if (v.type === 'reservation') {
        const actor = (v.cancel_actor || '').toLowerCase();
        return actor === 'restaurant' || actor === 'restaurante' || actor === 'admin' || actor === 'panel';
      }
      return false;
    });

    // No-shows in last 60 days
    const recentNoShows = noShowVisits.filter((v: any) => {
      const eventDate = new Date(v.date || v.created_at);
      return eventDate >= sixtyDaysAgo;
    });

    // Customer's last wait time
    const customerWaitTimes = queueData
      .filter((q: any) => q.status === 'seated' && q.wait_time && q.wait_time > 0)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastWaitTime = customerWaitTimes.length > 0 ? customerWaitTimes[0].wait_time : null;
    const customerAvgWaitTime = customerWaitTimes.length > 0
      ? Math.round(customerWaitTimes.reduce((acc: number, q: any) => acc + q.wait_time, 0) / customerWaitTimes.length)
      : null;

    // Average party size
    const avgPartySize = completedVisits.length > 0
      ? Math.round(completedVisits.reduce((acc: number, v: any) => acc + (v.party_size || 0), 0) / completedVisits.length)
      : 0;

    // Preferred time
    const hours = completedVisits.filter((v: any) => v.date).map((v: any) => new Date(v.date).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach((h: number) => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const mostFrequentHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const preferredTime = mostFrequentHour ? `${mostFrequentHour[0]}:00` : null;

    // Show rate: completed vs (completed + no_show + canceled)
    const totalWithOutcome = completedVisits.length + noShowVisits.length + canceledVisits.length;
    const showRate = totalWithOutcome > 0
      ? Math.round((completedVisits.length / totalWithOutcome) * 100)
      : 100;

    // Preferred channel
    const queueCompleted = queueData.filter((q: any) => q.status === 'seated').length;
    const reservationCompleted = reservationData.filter((r: any) => r.status === 'completed').length;
    const preferredChannel = queueCompleted >= reservationCompleted ? 'queue' : 'reservation';

    // Trend: visits last 30d vs prev 30d
    const visitsLast30d = completedVisits.filter((v: any) => new Date(v.date) >= thirtyDaysAgo).length;
    const visitsPrev30d = completedVisits.filter((v: any) => {
      const d = new Date(v.date);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    }).length;
    const trendDiff = visitsLast30d - visitsPrev30d;
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (trendDiff >= 2) trendDirection = 'up';
    else if (trendDiff <= -2) trendDirection = 'down';

    // Last visit date
    const lastCompletedVisit = completedVisits
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const lastVisitAt = lastCompletedVisit ? lastCompletedVisit.date : null;
    const daysSinceLastVisit = lastVisitAt
      ? Math.floor((now.getTime() - new Date(lastVisitAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // 7. Score MesaClik (0-100)
    let score = 50;
    if (visitsLast30d >= 2) score += 10;
    const visitsLast90d = completedVisits.filter((v: any) => new Date(v.date) >= ninetyDaysAgoDate).length;
    if (visitsLast90d >= 5) score += 10;
    const noShowCount90d = noShowVisits.filter((v: any) => new Date(v.date || v.created_at) >= ninetyDaysAgoDate).length;
    if (noShowCount90d === 0) score += 10;
    if (noShowCount90d >= 2) score -= 15;
    const cancelByCustomer90d = allVisits.filter((v: any) => {
      if (v.status !== 'canceled') return false;
      const d = new Date(v.canceled_at || v.date || v.created_at);
      if (d < ninetyDaysAgoDate) return false;
      const actor = (v.cancel_actor || '').toLowerCase();
      return actor === 'cliente' || actor === 'customer' || actor === '' || v.type === 'queue';
    }).length;
    if (cancelByCustomer90d >= 2) score -= 10;
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 45) score -= 10;
    if (customerData?.marketing_optin) score += 10;
    score = Math.max(0, Math.min(100, score));

    // Auto tags
    const autoTags: string[] = [];
    if (score >= 80 || completedVisits.length >= 10) autoTags.push('VIP');
    if (visitsLast30d >= 2) autoTags.push('Frequente');
    if ((daysSinceLastVisit !== null && daysSinceLastVisit > 60) || score <= 40) autoTags.push('Em risco');
    if (noShowCount90d >= 2) autoTags.push('Instável');

    // 8. Build Alerts
    const alerts: any[] = [];

    // Alert: Cancellation by restaurant
    if (recentCancelsByRestaurant.length > 0) {
      alerts.push({
        id: 'cancel_by_restaurant',
        severity: 'critical',
        title: `Atenção: o restaurante cancelou ${recentCancelsByRestaurant.length} reserva(s) deste cliente nos últimos 30 dias.`,
        cta: 'ver_eventos',
      });
    }

    // Alert: Wait time above average
    if (lastWaitTime && restaurantAvgWaitTime > 0 && lastWaitTime > restaurantAvgWaitTime * 1.3) {
      alerts.push({
        id: 'high_wait_time',
        severity: 'warning',
        title: `Tempo de espera acima da média: este cliente aguardou ${lastWaitTime} min (média do restaurante: ${restaurantAvgWaitTime} min).`,
        cta: null,
      });
    }

    // Alert: No-show
    if (recentNoShows.length >= 3) {
      alerts.push({
        id: 'no_show_critical',
        severity: 'critical',
        title: `Cliente não compareceu ${recentNoShows.length} vezes nos últimos 60 dias.`,
        cta: null,
      });
    } else if (recentNoShows.length >= 2) {
      alerts.push({
        id: 'no_show_warning',
        severity: 'warning',
        title: `Cliente não compareceu ${recentNoShows.length} vezes nos últimos 60 dias.`,
        cta: null,
      });
    }

    // Alert: Churn risk
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 60) {
      alerts.push({
        id: 'churn_critical',
        severity: 'critical',
        title: `Cliente pode estar inativo há ${daysSinceLastVisit} dias. Considere enviar uma promoção de retorno.`,
        cta: 'enviar_promocao',
      });
    } else if (daysSinceLastVisit !== null && daysSinceLastVisit > 30) {
      alerts.push({
        id: 'churn_warning',
        severity: 'warning',
        title: `Cliente sem visita há ${daysSinceLastVisit} dias. Atenção para risco de churn.`,
        cta: 'enviar_promocao',
      });
    }

    // 9. Monthly evolution (last 12 months)
    const monthlyEvolution: { month: string; queue: number; reservation: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7);
      const queueInMonth = queueData.filter((q: any) => {
        if (!q.date) return false;
        return String(q.date).startsWith(monthKey) && q.status === 'seated';
      }).length;
      const reservationInMonth = reservationData.filter((r: any) => {
        if (!r.date) return false;
        return String(r.date).startsWith(monthKey) && r.status === 'completed';
      }).length;
      monthlyEvolution.push({
        month: monthDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        queue: queueInMonth,
        reservation: reservationInMonth
      });
    }

    // 10. Preferred day of week
    const dayOfWeekCounts: Record<number, number> = {};
    completedVisits.forEach((v: any) => {
      if (!v.date) return;
      const dow = new Date(v.date).getDay();
      dayOfWeekCounts[dow] = (dayOfWeekCounts[dow] || 0) + 1;
    });
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const preferredDay = Object.entries(dayOfWeekCounts).sort((a, b) => b[1] - a[1])[0];
    const preferredDayName = preferredDay ? dayNames[parseInt(preferredDay[0])] : null;

    const metrics = {
      total_visits: completedVisits.length,
      queue_completed: queueCompleted,
      reservations_completed: reservationCompleted,
      canceled_count: canceledVisits.length,
      no_show_count: noShowVisits.length,
      no_show_count_60d: recentNoShows.length,
      promotions_sent: promotionHistory.length,
      avg_party_size: avgPartySize,
      preferred_time: preferredTime,
      preferred_channel: preferredChannel,
      preferred_day: preferredDayName,
      show_rate: showRate,
      monthly_evolution: monthlyEvolution,
      last_wait_time: lastWaitTime,
      customer_avg_wait_time: customerAvgWaitTime,
      restaurant_avg_wait_time: restaurantAvgWaitTime,
      visits_last_30d: visitsLast30d,
      visits_prev_30d: visitsPrev30d,
      cancel_by_restaurant_30d: recentCancelsByRestaurant.length,
      days_since_last_visit: daysSinceLastVisit,
    };

    const allHistory = [...queueData, ...reservationData, ...promotionHistory]
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    return new Response(JSON.stringify({
      customer: customerData,
      queue_history: queueData,
      reservation_history: reservationData,
      promotion_history: promotionHistory,
      all_history: allHistory,
      metrics,
      alerts,
      score: { value: score, tags: autoTags },
      trend: { direction: trendDirection, diff: trendDiff, last30d: visitsLast30d, prev30d: visitsPrev30d },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[get-customer-history] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

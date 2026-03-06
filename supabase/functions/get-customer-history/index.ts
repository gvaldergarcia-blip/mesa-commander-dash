import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── SECURITY FLAGS ──
const REQUIRE_JWT = (Deno.env.get("REQUIRE_JWT_GET_CUSTOMER_HISTORY") ?? "true") === "true";

// ── CORS (restricted allowlist) ──
const ALLOWED_ORIGINS = [
  "https://mesaclik.com.br", "https://www.mesaclik.com.br",
  "https://app.mesaclik.com.br", "https://painel.mesaclik.com.br",
  "http://localhost:5173", "http://localhost:3000", "http://localhost:8080",
];
const PREVIEW_ORIGIN_RE = /^https:\/\/.*\.lovable\.app$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

// ── Auth helper ──
async function authenticateRequest(req: Request, cors: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    if (REQUIRE_JWT) {
      return { user: null, error: new Response(JSON.stringify({ error: "Autenticação necessária" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } }) };
    }
    return { user: { id: "anonymous" }, error: null };
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { user: null, error: new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } }) };
  }
  return { user: data.user, error: null };
}

// ── Ownership helper ──
async function resolveRestaurantForUser(userId: string, requestedRestaurantId: string): Promise<{ allowed: boolean; restaurantId: string }> {
  if (userId === "anonymous") return { allowed: !REQUIRE_JWT, restaurantId: requestedRestaurantId };
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: member } = await supabase.from("restaurant_members").select("restaurant_id, role").eq("user_id", userId).eq("restaurant_id", requestedRestaurantId).maybeSingle();
  if (member) return { allowed: true, restaurantId: member.restaurant_id };
  const { data: admin } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (admin) return { allowed: true, restaurantId: requestedRestaurantId };
  return { allowed: false, restaurantId: requestedRestaurantId };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // 1. Auth
    const auth = await authenticateRequest(req, cors);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    const { customer_id, restaurant_id, email, phone } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: 'restaurant_id is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // 2. Ownership
    if (REQUIRE_JWT && userId !== "anonymous") {
      const ownership = await resolveRestaurantForUser(userId, restaurant_id);
      if (!ownership.allowed) {
        console.warn(`[get-customer-history] User ${userId} blocked — not member of ${restaurant_id}`);
        return new Response(JSON.stringify({ error: 'Acesso negado a este restaurante' }),
          { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Original business logic (unchanged) ──

    let customerData = null;
    let customerEmail = email;
    let customerPhone = phone;
    let customerId = customer_id;

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
        visit_history: [], promotion_history: [], metrics: null,
        alerts: [], score: null, trend: null,
      }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
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
      cancel_actor: q.cancel_actor || (q.canceled_at ? 'customer' : null),
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

    // 4. Fetch manual/direct visits
    let visitData: any[] = [];
    if (customerId) {
      const { data: visits } = await supabase
        .from('customer_visits')
        .select('id, customer_id, restaurant_id, visit_date, source, notes, created_at')
        .eq('restaurant_id', restaurant_id)
        .eq('customer_id', customerId)
        .order('visit_date', { ascending: false })
        .limit(200);

      visitData = (visits || []).map((v: any) => ({
        id: v.id, type: 'visit',
        date: v.visit_date, source: v.source,
        notes: v.notes, created_at: v.created_at,
        status: 'completed',
      }));
    }

    // 5. Fetch promotion history
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

    // 6. Fetch restaurant average wait time
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentQueues } = await supabase
      .from('queue_entries')
      .select('created_at, seated_at, queue_id')
      .eq('status', 'seated')
      .gte('created_at', ninetyDaysAgo)
      .limit(1000);

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

    // 7. Calculate comprehensive metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgoDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const allInteractions = [...queueData, ...reservationData];
    const completedInteractions = allInteractions.filter((v: any) => v.status === 'seated' || v.status === 'completed');
    const canceledVisits = allInteractions.filter((v: any) => v.status === 'canceled');
    const noShowVisits = allInteractions.filter((v: any) => v.status === 'no_show');

    const totalVisitsFromTable = visitData.length;
    const totalCompletedVisits = totalVisitsFromTable > 0 ? totalVisitsFromTable : completedInteractions.length;

    const recentCancelsByRestaurant = allInteractions.filter((v: any) => {
      if (v.status !== 'canceled') return false;
      const cancelDate = new Date(v.canceled_at || v.date || v.created_at);
      if (cancelDate < thirtyDaysAgo) return false;
      const actor = (v.cancel_actor || '').toLowerCase();
      return actor === 'restaurant' || actor === 'restaurante' || actor === 'admin' || actor === 'panel';
    });

    const recentNoShows = noShowVisits.filter((v: any) => {
      const eventDate = new Date(v.date || v.created_at);
      return eventDate >= sixtyDaysAgo;
    });

    const customerWaitTimes = queueData
      .filter((q: any) => q.status === 'seated' && q.wait_time && q.wait_time > 0)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastWaitTime = customerWaitTimes.length > 0 ? customerWaitTimes[0].wait_time : null;
    const customerAvgWaitTime = customerWaitTimes.length > 0
      ? Math.round(customerWaitTimes.reduce((acc: number, q: any) => acc + q.wait_time, 0) / customerWaitTimes.length)
      : null;

    const avgPartySize = completedInteractions.length > 0
      ? Math.round(completedInteractions.reduce((acc: number, v: any) => acc + (v.party_size || 0), 0) / completedInteractions.length)
      : 0;

    const allCompletedDates = [
      ...completedInteractions.filter((v: any) => v.date).map((v: any) => v.date),
      ...visitData.filter((v: any) => v.date).map((v: any) => v.date),
    ];
    const hours = allCompletedDates.map((d: string) => new Date(d).getHours());
    const hourCounts: Record<number, number> = {};
    hours.forEach((h: number) => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const mostFrequentHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const preferredTime = mostFrequentHour ? `${mostFrequentHour[0]}:00` : null;

    const totalWithOutcome = completedInteractions.length + noShowVisits.length + canceledVisits.length;
    const showRate = totalWithOutcome > 0
      ? Math.round((completedInteractions.length / totalWithOutcome) * 100)
      : 100;

    const queueCompleted = queueData.filter((q: any) => q.status === 'seated').length;
    const reservationCompleted = reservationData.filter((r: any) => r.status === 'completed').length;
    const manualVisits = visitData.filter((v: any) =>
      v.source === 'registro_manual' || v.source === 'promocao' || v.source === 'evento'
    ).length;

    let preferredChannel = 'queue';
    if (manualVisits > queueCompleted && manualVisits > reservationCompleted) preferredChannel = 'direct';
    else if (reservationCompleted > queueCompleted) preferredChannel = 'reservation';

    const visitsLast30d = totalVisitsFromTable > 0
      ? visitData.filter((v: any) => new Date(v.date) >= thirtyDaysAgo).length
      : completedInteractions.filter((v: any) => new Date(v.date) >= thirtyDaysAgo).length;

    const visitsPrev30d = totalVisitsFromTable > 0
      ? visitData.filter((v: any) => {
          const d = new Date(v.date);
          return d >= sixtyDaysAgo && d < thirtyDaysAgo;
        }).length
      : completedInteractions.filter((v: any) => {
          const d = new Date(v.date);
          return d >= sixtyDaysAgo && d < thirtyDaysAgo;
        }).length;

    const trendDiff = visitsLast30d - visitsPrev30d;
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (trendDiff >= 2) trendDirection = 'up';
    else if (trendDiff <= -2) trendDirection = 'down';

    const allVisitDates = [
      ...completedInteractions.map((v: any) => v.date),
      ...visitData.map((v: any) => v.date),
    ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const lastVisitAt = allVisitDates[0] || null;
    const daysSinceLastVisit = lastVisitAt
      ? Math.floor((now.getTime() - new Date(lastVisitAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // 8. Score MesaClik (0-100)
    let score = 30;
    const visitsLast90d = totalVisitsFromTable > 0
      ? visitData.filter((v: any) => new Date(v.date) >= ninetyDaysAgoDate).length
      : completedInteractions.filter((v: any) => new Date(v.date) >= ninetyDaysAgoDate).length;

    const noShowCount90d = noShowVisits.filter((v: any) => new Date(v.date || v.created_at) >= ninetyDaysAgoDate).length;
    const cancelByCustomer90d = allInteractions.filter((v: any) => {
      if (v.status !== 'canceled') return false;
      const d = new Date(v.canceled_at || v.date || v.created_at);
      if (d < ninetyDaysAgoDate) return false;
      const actor = (v.cancel_actor || '').toLowerCase();
      return actor === 'customer' || actor === 'cliente' || actor === '';
    }).length;

    if (daysSinceLastVisit !== null) {
      if (daysSinceLastVisit <= 3) score += 20;
      else if (daysSinceLastVisit <= 7) score += 15;
      else if (daysSinceLastVisit <= 14) score += 10;
      else if (daysSinceLastVisit <= 30) score += 5;
    }
    if (visitsLast30d >= 4) score += 15;
    else if (visitsLast30d >= 2) score += 10;
    else if (visitsLast30d >= 1) score += 5;
    if (visitsLast90d >= 8) score += 10;
    else if (visitsLast90d >= 4) score += 7;
    else if (visitsLast90d >= 2) score += 3;
    if (totalCompletedVisits >= 20) score += 10;
    else if (totalCompletedVisits >= 10) score += 7;
    else if (totalCompletedVisits >= 5) score += 4;
    if (showRate >= 95 && totalWithOutcome >= 3) score += 5;
    else if (showRate >= 80 && totalWithOutcome >= 2) score += 3;
    if (customerData?.marketing_optin) score += 5;
    if (trendDirection === 'up') score += 5;
    if (daysSinceLastVisit !== null) {
      if (daysSinceLastVisit > 90) score -= 20;
      else if (daysSinceLastVisit > 60) score -= 15;
      else if (daysSinceLastVisit > 45) score -= 10;
    }
    if (noShowCount90d >= 3) score -= 15;
    else if (noShowCount90d >= 2) score -= 10;
    else if (noShowCount90d >= 1) score -= 5;
    if (cancelByCustomer90d >= 3) score -= 10;
    else if (cancelByCustomer90d >= 2) score -= 7;
    if (trendDirection === 'down') score -= 5;
    if (totalCompletedVisits === 0) score = Math.min(score, 20);
    score = Math.max(0, Math.min(100, score));

    const autoTags: string[] = [];
    if (score >= 80 || totalCompletedVisits >= 10) autoTags.push('VIP');
    if (visitsLast30d >= 2) autoTags.push('Frequente');
    if ((daysSinceLastVisit !== null && daysSinceLastVisit > 60) || score <= 40) autoTags.push('Em risco');
    if (noShowCount90d >= 2) autoTags.push('Instável');

    // 9. Alerts
    const alerts: any[] = [];
    if (recentCancelsByRestaurant.length > 0) {
      alerts.push({ id: 'cancel_by_restaurant', severity: 'critical', title: `Atenção: o restaurante cancelou ${recentCancelsByRestaurant.length} reserva(s) deste cliente nos últimos 30 dias.`, cta: 'ver_eventos' });
    }
    if (lastWaitTime && restaurantAvgWaitTime > 0 && lastWaitTime > restaurantAvgWaitTime * 1.3) {
      alerts.push({ id: 'high_wait_time', severity: 'warning', title: `Tempo de espera acima da média: este cliente aguardou ${lastWaitTime} min (média do restaurante: ${restaurantAvgWaitTime} min).`, cta: null });
    }
    if (recentNoShows.length >= 3) {
      alerts.push({ id: 'no_show_critical', severity: 'critical', title: `Cliente não compareceu ${recentNoShows.length} vezes nos últimos 60 dias.`, cta: null });
    } else if (recentNoShows.length >= 2) {
      alerts.push({ id: 'no_show_warning', severity: 'warning', title: `Cliente não compareceu ${recentNoShows.length} vezes nos últimos 60 dias.`, cta: null });
    }
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 60) {
      alerts.push({ id: 'churn_critical', severity: 'critical', title: `Cliente pode estar inativo há ${daysSinceLastVisit} dias. Considere enviar uma promoção de retorno.`, cta: 'enviar_promocao' });
    } else if (daysSinceLastVisit !== null && daysSinceLastVisit > 30) {
      alerts.push({ id: 'churn_warning', severity: 'warning', title: `Cliente sem visita há ${daysSinceLastVisit} dias. Atenção para risco de churn.`, cta: 'enviar_promocao' });
    }

    // 10. Monthly evolution
    const monthlyEvolution: { month: string; queue: number; reservation: number; manual: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7);
      monthlyEvolution.push({
        month: monthDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        queue: queueData.filter((q: any) => q.date && String(q.date).startsWith(monthKey) && q.status === 'seated').length,
        reservation: reservationData.filter((r: any) => r.date && String(r.date).startsWith(monthKey) && r.status === 'completed').length,
        manual: visitData.filter((v: any) => v.date && String(v.date).startsWith(monthKey)).length,
      });
    }

    // 11. Preferred day
    const dayOfWeekCounts: Record<number, number> = {};
    [...completedInteractions, ...visitData].forEach((v: any) => {
      if (!v.date) return;
      const dow = new Date(v.date).getDay();
      dayOfWeekCounts[dow] = (dayOfWeekCounts[dow] || 0) + 1;
    });
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const preferredDay = Object.entries(dayOfWeekCounts).sort((a, b) => b[1] - a[1])[0];
    const preferredDayName = preferredDay ? dayNames[parseInt(preferredDay[0])] : null;

    const visitSourceBreakdown = {
      fila: queueCompleted,
      reserva: reservationCompleted,
      manual: visitData.filter((v: any) => v.source === 'registro_manual').length,
      promocao: visitData.filter((v: any) => v.source === 'promocao').length,
      evento: visitData.filter((v: any) => v.source === 'evento').length,
      qr_checkin: visitData.filter((v: any) => v.source === 'qr_checkin').length,
    };

    const metrics = {
      total_visits: totalCompletedVisits,
      queue_completed: queueCompleted,
      reservations_completed: reservationCompleted,
      manual_visits: manualVisits,
      visit_source_breakdown: visitSourceBreakdown,
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

    const allHistory = [...queueData, ...reservationData, ...visitData, ...promotionHistory]
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

    return new Response(JSON.stringify({
      customer: customerData,
      queue_history: queueData,
      reservation_history: reservationData,
      visit_history: visitData,
      promotion_history: promotionHistory,
      all_history: allHistory,
      metrics,
      alerts,
      score: { value: score, tags: autoTags },
      trend: { direction: trendDirection, diff: trendDiff, last30d: visitsLast30d, prev30d: visitsPrev30d },
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[get-customer-history] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
  }
});

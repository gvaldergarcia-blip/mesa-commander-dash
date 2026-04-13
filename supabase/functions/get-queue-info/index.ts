import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── SECURITY FLAGS ──
// If true, email/phone are NEVER returned in public responses
const HIDE_PII_QUEUE = (Deno.env.get("HIDE_PII_QUEUE") ?? "true") === "true";

// ── CORS (restricted allowlist) ──
const ALLOWED_ORIGINS = [
  "https://mesaclik.com.br", "https://www.mesaclik.com.br",
  "https://app.mesaclik.com.br", "https://painel.mesaclik.com.br",
  "http://localhost:5173", "http://localhost:3000", "http://localhost:8080",
];
const PREVIEW_ORIGIN_RE = /^https:\/\/.*\.(lovable\.app|lovableproject\.com)$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const ticket_id = body?.ticket_id as string | undefined;
    let restaurant_id = body?.restaurant_id as string | undefined;

    // Check if caller is authenticated (panel user) — for private mode
    let isAuthenticated = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await callerClient.auth.getUser();
      if (data?.user) {
        isAuthenticated = true;
      }
    }

    console.log('Request received:', { ticket_id, restaurant_id, isAuthenticated, hide_pii: HIDE_PII_QUEUE });

    if (!ticket_id && !restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'ticket_id ou restaurant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let entryData: {
      id: string;
      queue_id: string;
      restaurant_id: string;
      status: string;
      party_size: number;
      position: number | null;
      created_at: string;
      name: string | null;
      email: string | null;
      phone: string | null;
    } | null = null;

    if (ticket_id) {
      const { data: entry, error: entryError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('id, queue_id, restaurant_id, status, party_size, position, created_at, name, email, phone')
        .eq('id', ticket_id)
        .maybeSingle();

      if (entryError) {
        console.error('Erro ao buscar entrada:', entryError);
        return new Response(
          JSON.stringify({ found: false, error: 'Erro ao buscar entrada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!entry) {
        return new Response(
          JSON.stringify({ found: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isActiveEntry = entry.status === 'waiting' || entry.status === 'called';

      if (!isActiveEntry && entry.created_at < cutoff) {
        return new Response(
          JSON.stringify({ found: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      entryData = entry as any;
      restaurant_id = restaurant_id || entry.restaurant_id;
    }

    if (!restaurant_id) {
      return new Response(
        JSON.stringify({ found: false, error: 'restaurant_id não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const getSizeBucket = (partySize: number): '1-2' | '3-4' | '5-6' | '7-8' | '9-10' | '10+' => {
      if (partySize >= 1 && partySize <= 2) return '1-2';
      if (partySize >= 3 && partySize <= 4) return '3-4';
      if (partySize >= 5 && partySize <= 6) return '5-6';
      if (partySize >= 7 && partySize <= 8) return '7-8';
      if (partySize >= 9 && partySize <= 10) return '9-10';
      return '10+';
    };

    const getSizeBucketLabel = (bucket: string): string => {
      switch (bucket) {
        case '1-2': return '1–2 pessoas';
        case '3-4': return '3–4 pessoas';
        case '5-6': return '5–6 pessoas';
        case '7-8': return '7–8 pessoas';
        case '9-10': return '9–10 pessoas';
        case '10+': return '10+ pessoas';
        default: return bucket;
      }
    };

    const { data: queueSettings, error: settingsError } = await supabase
      .from('queue_settings')
      .select('tolerance_minutes, max_party_size, queue_capacity')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    const { data: restaurantMesaclik } = await supabase
      .schema('mesaclik')
      .from('restaurants')
      .select('name, logo_url, menu_url')
      .eq('id', restaurant_id)
      .maybeSingle();

    const { data: restaurantPublic } = restaurantMesaclik?.name
      ? { data: null }
      : await supabase
          .from('restaurants')
          .select('name')
          .eq('id', restaurant_id)
          .maybeSingle();

    const restaurant_name = restaurantMesaclik?.name || restaurantPublic?.name || 'Restaurante';
    const restaurant_logo_url = restaurantMesaclik?.logo_url || null;
    const restaurant_menu_url = restaurantMesaclik?.menu_url || null;
    const shouldUseFullQueueWindow = !!entryData
      && (entryData.status === 'waiting' || entryData.status === 'called')
      && entryData.created_at < cutoff;

    let waitingQuery = supabase
      .schema('mesaclik')
      .from('queue_entries')
      .select('id, queue_id, party_size, created_at, name, phone')
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (!shouldUseFullQueueWindow) {
      waitingQuery = waitingQuery.gte('created_at', cutoff);
    }

    if (entryData?.queue_id) {
      waitingQuery = waitingQuery.eq('queue_id', entryData.queue_id);
    }

    const { data: waitingEntries, error: entriesError } = await waitingQuery;

    if (entriesError) {
      console.error('Erro ao buscar entradas da fila:', entriesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar entradas da fila' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entries = waitingEntries || [];
    const total_groups = entries.length;
    const total_people = entries.reduce((sum, entry) => sum + (entry.party_size || 0), 0);

    let position: number | null = null;
    let user_entry: {
      id: string;
      queue_id: string;
      party_size: number;
      customer_name: string | null;
      phone: string | null;
      created_at: string;
    } | null = null;

    if (ticket_id && entryData) {
      // ── PII PROTECTION ──
      // Only include PII if caller is authenticated OR HIDE_PII_QUEUE is disabled
      const shouldHidePII = HIDE_PII_QUEUE && !isAuthenticated;

      user_entry = {
        id: entryData.id,
        queue_id: entryData.queue_id,
        party_size: entryData.party_size,
        customer_name: entryData.name, // Name kept for UX (first name only display)
        phone: shouldHidePII ? null : entryData.phone,
        created_at: entryData.created_at,
      };

      if (entryData.status === 'waiting') {
        const bucket = getSizeBucket(Number(entryData.party_size || 1));
        const sameBucket = entries.filter((e) => getSizeBucket(Number(e.party_size || 1)) === bucket);
        const index = sameBucket.findIndex((e) => e.id === ticket_id);
        if (index !== -1) {
          position = index + 1;
        } else if (typeof entryData.position === 'number') {
          position = entryData.position;
        }
      }
    }

    // ── PII PROTECTION ──
    // When a specific ticket_id is provided, the caller owns that link (sent via email).
    // We return their own email so the consent form can work, but never expose phone.
    // For generic queries (no ticket_id), hide all PII.
    const shouldHidePII = HIDE_PII_QUEUE && !isAuthenticated;
    const isOwnTicket = !!ticket_id && !!entryData;

    const response = {
      found: ticket_id ? !!entryData : true,
      ticket_id: ticket_id ?? null,
      restaurant_id,
      restaurant_name,
      restaurant_logo_url,
      restaurant_menu_url,
      queue_id: entryData?.queue_id ?? null,
      status: entryData?.status ?? null,
      party_size: entryData?.party_size ?? null,
      created_at: entryData?.created_at ?? null,
      customer_name: entryData?.name ?? null, // Kept for UX
      // Email: returned for own ticket (needed for consent flow), hidden otherwise
      customer_email: (isOwnTicket || !shouldHidePII) ? (entryData?.email ?? null) : null,
      customer_phone: shouldHidePII ? null : (entryData?.phone ?? null),
      size_group: entryData ? getSizeBucketLabel(getSizeBucket(Number(entryData.party_size || 1))) : null,
      total_groups,
      total_people,
      position,
      user_entry,
      tolerance_minutes: queueSettings?.tolerance_minutes ?? 10,
      max_party_size: queueSettings?.max_party_size ?? 8,
      queue_capacity: queueSettings?.queue_capacity ?? 50,
      cutoff,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const corsH = getCorsHeaders(req);
    console.error('Erro na função get-queue-info:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );
  }
});

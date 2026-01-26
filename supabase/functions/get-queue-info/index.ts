import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log('Request received:', { ticket_id, restaurant_id });

    if (!ticket_id && !restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'ticket_id ou restaurant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IMPORTANT: alinhar com o painel (Tela Comando)
    // O painel considera apenas registros das últimas 24 horas.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Se veio ticket_id, buscar a entrada (independente do status), e derivar restaurant_id/queue_id
    let entryData:
      | {
          id: string;
          queue_id: string;
          restaurant_id: string;
          status: string;
          party_size: number;
          created_at: string;
          name: string | null;
          email: string | null;
          phone: string | null;
        }
      | null = null;

    if (ticket_id) {
      const { data: entry, error: entryError } = await supabase
        .schema('mesaclik')
        .from('queue_entries')
        .select('id, queue_id, restaurant_id, status, party_size, created_at, name, email, phone')
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

      // Expirar links antigos (mesma janela do painel)
      if (entry.created_at < cutoff) {
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
        case '1-2':
          return '1–2 pessoas';
        case '3-4':
          return '3–4 pessoas';
        case '5-6':
          return '5–6 pessoas';
        case '7-8':
          return '7–8 pessoas';
        case '9-10':
          return '9–10 pessoas';
        case '10+':
          return '10+ pessoas';
        default:
          return bucket;
      }
    };

    // Buscar configurações da FILA (queue_settings) - NÃO reservation_settings!
    const { data: queueSettings, error: settingsError } = await supabase
      .from('queue_settings')
      .select('tolerance_minutes, max_party_size, queue_capacity')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    console.log('Queue settings:', { queueSettings, settingsError });

    // Buscar nome do restaurante (preferir mesaclik.restaurants)
    const { data: restaurantMesaclik } = await supabase
      .schema('mesaclik')
      .from('restaurants')
      .select('name')
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

    // Buscar todas as entradas aguardando no restaurante (últimas 24h), ordenadas por created_at ASC, id ASC
    // Para calcular posição, preferimos filtrar por queue_id quando possível (evita misturar filas do mesmo restaurante).
    let waitingQuery = supabase
      .schema('mesaclik')
      .from('queue_entries')
      .select('id, queue_id, party_size, created_at, name, phone')
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'waiting')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (entryData?.queue_id) {
      waitingQuery = waitingQuery.eq('queue_id', entryData.queue_id);
    }

    const { data: waitingEntries, error: entriesError } = await waitingQuery;

    console.log('Waiting entries:', { cutoff, count: waitingEntries?.length, entriesError });

    if (entriesError) {
      console.error('Erro ao buscar entradas da fila:', entriesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar entradas da fila' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entries = waitingEntries || [];

    // Calcular totais
    const total_groups = entries.length;
    const total_people = entries.reduce((sum, entry) => sum + (entry.party_size || 0), 0);

    // Posição do usuário (por grupo) no recorte das últimas 24h
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
      user_entry = {
        id: entryData.id,
        queue_id: entryData.queue_id,
        party_size: entryData.party_size,
        customer_name: entryData.name,
        phone: entryData.phone,
        created_at: entryData.created_at,
      };

      if (entryData.status === 'waiting') {
        const bucket = getSizeBucket(Number(entryData.party_size || 1));
        const sameBucket = entries.filter((e) => getSizeBucket(Number(e.party_size || 1)) === bucket);
        const index = sameBucket.findIndex((e) => e.id === ticket_id);
        if (index !== -1) {
          position = index + 1; // 1-indexed dentro do bucket
        }
      }
    }

    const response = {
      found: ticket_id ? !!entryData : true,
      ticket_id: ticket_id ?? null,
      restaurant_id,
      restaurant_name,
      queue_id: entryData?.queue_id ?? null,
      status: entryData?.status ?? null,
      party_size: entryData?.party_size ?? null,
      created_at: entryData?.created_at ?? null,
      customer_name: entryData?.name ?? null,
      customer_email: entryData?.email ?? null,
      customer_phone: entryData?.phone ?? null,
      size_group: entryData ? getSizeBucketLabel(getSizeBucket(Number(entryData.party_size || 1))) : null,
      total_groups,
      total_people,
      position,
      user_entry,
      // Configurações da FILA (queue_settings)
      tolerance_minutes: queueSettings?.tolerance_minutes ?? 10,
      max_party_size: queueSettings?.max_party_size ?? 8,
      queue_capacity: queueSettings?.queue_capacity ?? 50,
      // para debug/auditoria (não expõe dados sensíveis)
      cutoff,
    };

    console.log('Queue info response:', response);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na função get-queue-info:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

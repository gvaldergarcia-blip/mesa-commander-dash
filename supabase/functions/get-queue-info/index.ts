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

    const { ticket_id, restaurant_id } = await req.json();

    console.log('Request received:', { ticket_id, restaurant_id });

    if (!restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'restaurant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IMPORTANT: alinhar com o painel (Tela Comando)
    // O painel considera apenas registros das últimas 24 horas.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Buscar configurações da FILA (queue_settings) - NÃO reservation_settings!
    const { data: queueSettings, error: settingsError } = await supabase
      .from('queue_settings')
      .select('tolerance_minutes, max_party_size, queue_capacity')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    console.log('Queue settings:', { queueSettings, settingsError });

    // Buscar todas as entradas aguardando no restaurante, ordenadas por created_at ASC, id ASC
    const { data: waitingEntries, error: entriesError } = await supabase
      .schema('mesaclik')
      .from('queue_entries')
      .select('id, queue_id, party_size, created_at, name, phone')
      .eq('restaurant_id', restaurant_id)
      .eq('status', 'waiting')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

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

    // Posição do usuário no recorte das últimas 24h (mesma lista usada para totals)
    let position: number | null = null;
    let user_entry: {
      id: string;
      queue_id: string;
      party_size: number;
      customer_name: string;
      phone: string;
      created_at: string;
    } | null = null;

    if (ticket_id) {
      const index = entries.findIndex((entry) => entry.id === ticket_id);
      if (index !== -1) {
        position = index + 1; // 1-indexed
        const entry = entries[index];
        user_entry = {
          id: entry.id,
          queue_id: entry.queue_id,
          party_size: entry.party_size,
          customer_name: entry.name,
          phone: entry.phone,
          created_at: entry.created_at,
        };
      }
    }

    const response = {
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

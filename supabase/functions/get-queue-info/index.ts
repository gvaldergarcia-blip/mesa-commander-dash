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

    // Buscar a fila ativa do restaurante (usando schema public)
    const { data: queue, error: queueError } = await supabase
      .from('queues')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    console.log('Queue query result:', { queue, queueError });

    if (queueError) {
      console.error('Erro ao buscar fila:', queueError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar fila' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!queue) {
      return new Response(
        JSON.stringify({ 
          total_groups: 0, 
          total_people: 0, 
          position: null,
          message: 'Nenhuma fila encontrada para este restaurante' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todas as entradas aguardando na fila, ordenadas por created_at
    const { data: waitingEntries, error: entriesError } = await supabase
      .from('queue_entries')
      .select('id, party_size, created_at, customer_name, phone')
      .eq('queue_id', queue.id)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    console.log('Waiting entries:', { count: waitingEntries?.length, entriesError });

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

    // Se um ticket_id foi fornecido, calcular a posição
    let position = null;
    let user_entry = null;

    if (ticket_id) {
      const index = entries.findIndex(entry => entry.id === ticket_id);
      if (index !== -1) {
        position = index + 1; // Posição é 1-indexed
        user_entry = {
          id: entries[index].id,
          party_size: entries[index].party_size,
          customer_name: entries[index].customer_name,
          phone: entries[index].phone,
          created_at: entries[index].created_at
        };
      }
    }

    const response = {
      total_groups,
      total_people,
      position,
      user_entry,
      queue_id: queue.id
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

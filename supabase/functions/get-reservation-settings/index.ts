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

    const { restaurant_id } = await req.json();

    console.log('Request received:', { restaurant_id });

    if (!restaurant_id) {
      return new Response(
        JSON.stringify({ error: 'restaurant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações de RESERVA (reservation_settings)
    const { data: reservationSettings, error: settingsError } = await supabase
      .from('reservation_settings')
      .select('max_party_size, tolerance_minutes')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    console.log('Reservation settings:', { reservationSettings, settingsError });

    if (settingsError) {
      console.error('Erro ao buscar configurações de reserva:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configurações de reserva' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = {
      // Configurações de RESERVA (reservation_settings)
      max_party_size: reservationSettings?.max_party_size ?? 8,
      tolerance_minutes: reservationSettings?.tolerance_minutes ?? 15,
    };

    console.log('Reservation settings response:', response);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na função get-reservation-settings:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

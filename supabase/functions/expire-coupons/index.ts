import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  try {
    console.log('Iniciando job de expiração de cupons...');

    // Expirar cupons antigos
    const { data: expiredCoupons, error: expireError } = await supabase
      .schema('mesaclik')
      .rpc('expire_old_coupons');

    if (expireError) {
      console.error('Erro ao expirar cupons:', expireError);
      throw expireError;
    }

    console.log('Cupons expirados com sucesso');

    // Ativar cupons agendados
    const { data: activatedCoupons, error: activateError } = await supabase
      .schema('mesaclik')
      .rpc('activate_scheduled_coupons');

    if (activateError) {
      console.error('Erro ao ativar cupons:', activateError);
      throw activateError;
    }

    console.log('Cupons agendados ativados com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cupons processados com sucesso' 
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Erro no job de expiração:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

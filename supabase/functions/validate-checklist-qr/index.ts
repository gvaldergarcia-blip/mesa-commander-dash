import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const today = () => new Date().toISOString().slice(0, 10);

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
    const item_id = body?.item_id as string | undefined;

    if (!item_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'item_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar item ativo
    const { data: item, error: itemError } = await supabase
      .from('checklist_items')
      .select('id, name, restaurant_id, active')
      .eq('id', item_id)
      .eq('active', true)
      .maybeSingle();

    if (itemError || !item) {
      return new Response(
        JSON.stringify({ success: false, error: 'QR Code inválido ou item inativo.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já foi validado hoje
    const { data: existing } = await supabase
      .from('checklist_completions')
      .select('id')
      .eq('item_id', item.id)
      .eq('restaurant_id', item.restaurant_id)
      .eq('completion_date', today())
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase
        .from('checklist_completions')
        .insert({
          item_id: item.id,
          restaurant_id: item.restaurant_id,
          completed_by: null,
          completed_by_name: 'Equipe (QR)',
          via_qr: true,
        });

      if (insertError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Não foi possível registrar a validação.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        item_name: item.name,
        already_validated: !!existing,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[validate-checklist-qr] erro:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
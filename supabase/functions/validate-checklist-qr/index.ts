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

    // Aceita item_id via JSON (POST) ou query string (GET) — assim qualquer
    // leitor de QR que abra a URL diretamente também valida.
    let item_id: string | undefined;
    if (req.method === 'GET') {
      item_id = new URL(req.url).searchParams.get('item_id') ?? undefined;
    } else {
      const body = await req.json().catch(() => ({}));
      item_id = body?.item_id as string | undefined;
    }

    if (!item_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'item_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar item (mesmo inativo, para dar mensagem clara)
    const { data: item, error: itemError } = await supabase
      .from('checklist_items')
      .select('id, name, restaurant_id, active, daily_frequency')
      .eq('id', item_id)
      .maybeSingle();

    if (itemError) {
      console.error('[validate-checklist-qr] db error:', itemError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao consultar atividade.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!item) {
      return new Response(
        JSON.stringify({ success: false, error: 'Atividade não encontrada. Pode ter sido removida do checklist.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!item.active) {
      return new Response(
        JSON.stringify({ success: false, error: `A atividade "${item.name}" está desativada no checklist.` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Conta validações de hoje e respeita daily_frequency
    const { data: existingList } = await supabase
      .from('checklist_completions')
      .select('id')
      .eq('item_id', item.id)
      .eq('restaurant_id', item.restaurant_id)
      .eq('completion_date', today());

    const doneCount = existingList?.length ?? 0;
    const limit = Math.max(1, (item as any).daily_frequency ?? 1);
    const alreadyAtLimit = doneCount >= limit;

    if (!alreadyAtLimit) {
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
        already_validated: alreadyAtLimit,
        done_count: alreadyAtLimit ? doneCount : doneCount + 1,
        daily_frequency: limit,
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
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Payload {
  restaurant_id?: string;
  mode?: 'scheduled' | 'test';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body: Payload = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Determinar restaurantes a processar
    let restaurantIds: string[] = [];
    if (body.restaurant_id) {
      restaurantIds = [body.restaurant_id];
    } else {
      const { data } = await supabase.from('restaurants').select('id');
      restaurantIds = (data || []).map((r: any) => r.id);
    }

    const results: any[] = [];

    for (const restaurantId of restaurantIds) {
      // 2. Buscar produtos em falta
      const { data: missing } = await supabase
        .from('product_stock_status')
        .select('product_id, marked_at, marked_by_name')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'falta');

      if (!missing || missing.length === 0) {
        results.push({ restaurant_id: restaurantId, skipped: 'nenhum item em falta' });
        continue;
      }

      // 3. Nomes dos produtos
      const productIds = missing.map((m: any) => m.product_id);
      const { data: products } = await supabase
        .from('label_products')
        .select('id, name, category')
        .in('id', productIds);

      const names = (products || [])
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
        .map((p: any) => p.name);

      // 4. Buscar chefs / admins do restaurante com WhatsApp
      const { data: chefs } = await supabase
        .from('label_employees')
        .select('id, name, whatsapp_phone, role')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .not('whatsapp_phone', 'is', null);

      const recipients = (chefs || []).filter((c: any) => {
        const role = (c.role || '').toLowerCase();
        return role.includes('chef') || role.includes('gerente') || role.includes('admin') || role.includes('propriet') || role.includes('dono');
      });

      // Fallback: se nenhum chef, envia pro primeiro funcionário com telefone
      const targets = recipients.length > 0 ? recipients : (chefs || []).slice(0, 1);

      if (targets.length === 0) {
        results.push({ restaurant_id: restaurantId, skipped: 'nenhum destinatário' });
        continue;
      }

      // 5. Montar mensagem
      const listStr = names.slice(0, 15).join(', ') + (names.length > 15 ? `... (+${names.length - 15})` : '');
      const message = `[MESACLIK] Lista de compras hoje (${names.length} item${names.length > 1 ? 's' : ''}): ${listStr}. Ver: https://app.mesaclik.com.br/etiquetas`;

      // 6. Enviar via send-sms interno
      for (const target of targets) {
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              to: target.whatsapp_phone,
              message,
              prefer_whatsapp: true,
            }),
          });
          const smsResult = await resp.json();
          results.push({ restaurant_id: restaurantId, to: target.name, ok: resp.ok, sms: smsResult });
        } catch (e: any) {
          results.push({ restaurant_id: restaurantId, to: target.name, error: e.message });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('send-stock-alert error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
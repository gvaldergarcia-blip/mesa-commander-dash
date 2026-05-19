import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { restaurantId } = await req.json();
    if (!restaurantId) {
      return new Response(JSON.stringify({ error: "restaurantId required" }), { status: 400, headers: corsHeaders });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: cred, error } = await admin.rpc("internal_get_whatsapp_credentials", { p_restaurant_id: restaurantId });
    if (error || !cred) {
      return new Response(JSON.stringify({ error: "config not found" }), { status: 404, headers: corsHeaders });
    }
    const { twilio_account_sid, twilio_auth_token, whatsapp_number, webhook_secret } = cred as any;
    if (!twilio_auth_token) {
      return new Response(JSON.stringify({ error: "Não foi possível ler o token. Reconfigure." }), { status: 500, headers: corsHeaders });
    }

    // Testa a credencial chamando GET /Accounts/{sid}.json
    const basic = btoa(`${twilio_account_sid}:${twilio_auth_token}`);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio_account_sid}.json`, {
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!r.ok) {
      const txt = await r.text();
      await admin.rpc("set_whatsapp_status", { p_restaurant_id: restaurantId, p_status: "error", p_error: `Twilio rejeitou: ${r.status}` });
      return new Response(JSON.stringify({ ok: false, error: `Twilio rejeitou (${r.status}): ${txt}` }), { status: 400, headers: corsHeaders });
    }

    const acct = await r.json();
    await admin.rpc("set_whatsapp_status", { p_restaurant_id: restaurantId, p_status: "connected", p_error: null });

    const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-inbound?r=${restaurantId}&s=${webhook_secret}`;

    return new Response(JSON.stringify({
      ok: true,
      friendly_name: acct.friendly_name,
      whatsapp_number,
      webhook_url: webhookUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "erro" }), { status: 500, headers: corsHeaders });
  }
});
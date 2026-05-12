import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY")!;
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;

function toE164BR(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55")) return `+${d}`;
  if (d.length >= 10) return `+55${d}`;
  return `+${d}`;
}

async function sendMms(to: string, body: string, mediaUrl: string | null) {
  const params = new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body });
  if (mediaUrl) params.append("MediaUrl", mediaUrl);

  const r = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${JSON.stringify(data)}`);
  return data.sid as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: pending, error } = await admin
    .from("menu_dish_campaigns")
    .select("id, phone, message, image_url, restaurant_id, customer_id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .limit(20);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const results: any[] = [];
  for (const c of pending ?? []) {
    try {
      const sid = await sendMms(toE164BR(c.phone), c.message, c.image_url);
      await admin
        .from("menu_dish_campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString(), twilio_sid: sid })
        .eq("id", c.id);
      results.push({ id: c.id, status: "sent", sid });
    } catch (e: any) {
      await admin
        .from("menu_dish_campaigns")
        .update({ status: "failed", error: String(e?.message ?? e) })
        .eq("id", c.id);
      results.push({ id: c.id, status: "failed", error: String(e?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
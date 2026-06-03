import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PANEL_URL = "https://app.mesaclik.com.br/etiquetas";
const MAX_LEN = 320;

interface Body {
  employee_id: string;
  mode?: "scheduled" | "test" | "expiry_alert";
  triggered_label_id?: string;
}

function trim(msg: string, max = MAX_LEN) {
  if (msg.length <= max) return msg;
  return msg.slice(0, max - 1) + "…";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { employee_id, mode = "scheduled", triggered_label_id }: Body = await req.json();
    if (!employee_id) {
      return new Response(JSON.stringify({ error: "employee_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: emp, error: empErr } = await sb
      .from("label_employees").select("*").eq("id", employee_id).single();
    if (empErr || !emp) throw new Error(empErr?.message || "Funcionário não encontrado");

    if (!emp.whatsapp_phone) {
      return new Response(JSON.stringify({ error: "Funcionário sem telefone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch labels for the employee's sectors
    const sectors: string[] = emp.sectors || [];
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

    const { data: labels } = await sb
      .from("label_issuances")
      .select("id, product_name, expiry_date, status, label_product_id, product:label_product_id ( category )")
      .eq("restaurant_id", emp.restaurant_id)
      .neq("status", "discharged")
      .limit(1000);

    const inSector = (l: any) => {
      if (!sectors.length) return true;
      const cat = l.product?.category;
      return cat && sectors.includes(cat);
    };

    const relevant = (labels || []).filter(inSector);
    let expired = 0, today = 0, next24h = 0;
    const expiredItems: string[] = [];
    for (const l of relevant) {
      const exp = new Date(l.expiry_date);
      if (exp <= now) {
        expired++;
        if (expiredItems.length < 3) expiredItems.push(l.product_name);
      } else if (exp <= endOfToday) {
        today++;
      } else if (exp <= in24h) {
        next24h++;
      }
    }

    // Build message
    const prefix = `[MESACLIK] ${mode === "test" ? "(Teste) " : ""}${emp.name.split(" ")[0]},`;
    let body: string;
    if (expired === 0 && today === 0 && next24h === 0) {
      body = `Tudo dentro do prazo ✅`;
    } else {
      body = `Vencidas:${expired} | Hoje:${today} | 24h:${next24h}`;
      if (expiredItems.length) {
        body += `\n⚠ ${expiredItems.join(", ")}`;
      }
    }

    const tail = `\n${PANEL_URL}`;
    const message = trim(`${prefix} ${body}${tail}`);

    // Send SMS via internal bridge
    const phoneDigits = emp.whatsapp_phone.replace(/\D/g, "");
    const to = phoneDigits.startsWith("55") ? `+${phoneDigits}` : `+55${phoneDigits}`;

    const smsRes = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ to, message }),
    });
    const smsData = await smsRes.json().catch(() => ({}));
    const success = !!smsData?.success;

    const kind = mode === "test" ? "test" : mode === "expiry_alert" ? "expiry_alert" : "daily";

    await sb.from("label_sms_logs").insert({
      restaurant_id: emp.restaurant_id,
      employee_id: emp.id,
      phone: to,
      message,
      kind,
      status: success ? "sent" : "failed",
      error: success ? null : (smsData?.message || smsData?.error || "Falha no envio"),
      triggered_label_id: triggered_label_id || null,
    });

    return new Response(JSON.stringify({ success, message, sms: smsData }), {
      status: success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-label-daily-report]", e);
    return new Response(JSON.stringify({ error: e.message || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PANEL_URL = "https://app.mesaclik.com.br/etiquetas";
const MAX_LEN = 1200; // ~8 segmentos SMS — relatório completo

interface Body {
  employee_id: string;
  mode?: "scheduled" | "test" | "expiry_alert";
  triggered_label_id?: string;
  phone_override?: string;
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

    const { employee_id, mode = "scheduled", triggered_label_id, phone_override }: Body = await req.json();
    if (!employee_id) {
      return new Response(JSON.stringify({ error: "employee_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: emp, error: empErr } = await sb
      .from("label_employees").select("*").eq("id", employee_id).single();
    if (empErr || !emp) throw new Error(empErr?.message || "Funcionário não encontrado");

    const rawPhone = phone_override?.trim() || emp.whatsapp_phone;

    if (!rawPhone) {
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
    const fmtHora = (d: Date) =>
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const fmtDia = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

    const expiredList: { name: string; exp: Date }[] = [];
    const todayList: { name: string; exp: Date }[] = [];
    const next24hList: { name: string; exp: Date }[] = [];
    for (const l of relevant) {
      const exp = new Date(l.expiry_date);
      if (exp <= now) expiredList.push({ name: l.product_name, exp });
      else if (exp <= endOfToday) todayList.push({ name: l.product_name, exp });
      else if (exp <= in24h) next24hList.push({ name: l.product_name, exp });
    }
    expiredList.sort((a, b) => a.exp.getTime() - b.exp.getTime());
    todayList.sort((a, b) => a.exp.getTime() - b.exp.getTime());
    next24hList.sort((a, b) => a.exp.getTime() - b.exp.getTime());

    const totalActive = relevant.length;
    const firstName = emp.name.split(" ")[0];
    const saudacao =
      mode === "test"
        ? `[MESACLIK] Teste de relatório - ${firstName}`
        : mode === "expiry_alert"
        ? `[MESACLIK] Alerta de vencimento - ${firstName}`
        : `[MESACLIK] Bom dia, ${firstName}!`;

    const dataHoje = fmtDia(now);
    const setoresLabel = sectors.length ? sectors.slice(0, 4).join(", ") : "Todos os setores";

    const linhas: string[] = [];
    linhas.push(saudacao);
    linhas.push(`Relatório de ${dataHoje} | ${setoresLabel}`);
    linhas.push(`Total ativas: ${totalActive}`);
    linhas.push("");

    if (expiredList.length === 0 && todayList.length === 0 && next24hList.length === 0) {
      linhas.push("Tudo dentro do prazo ✅");
      linhas.push("Nenhuma etiqueta exige atenção agora.");
    } else {
      if (expiredList.length) {
        linhas.push(`🚨 VENCIDAS (${expiredList.length}) - remover agora:`);
        for (const item of expiredList.slice(0, 6)) {
          linhas.push(`• ${item.name} (venceu ${fmtDia(item.exp)} ${fmtHora(item.exp)})`);
        }
        if (expiredList.length > 6) linhas.push(`+ ${expiredList.length - 6} outras vencidas`);
      }
      if (todayList.length) {
        linhas.push(`⚠ VENCEM HOJE (${todayList.length}):`);
        for (const item of todayList.slice(0, 5)) {
          linhas.push(`• ${item.name} às ${fmtHora(item.exp)}`);
        }
        if (todayList.length > 5) linhas.push(`+ ${todayList.length - 5} outras hoje`);
      }
      if (next24hList.length) {
        linhas.push(`🕒 Próximas 24h (${next24hList.length}):`);
        for (const item of next24hList.slice(0, 4)) {
          linhas.push(`• ${item.name} - ${fmtDia(item.exp)} ${fmtHora(item.exp)}`);
        }
        if (next24hList.length > 4) linhas.push(`+ ${next24hList.length - 4} outras em 24h`);
      }
    }

    linhas.push("");
    linhas.push(`Painel: ${PANEL_URL}`);

    const message = trim(linhas.join("\n"));

    // Send WhatsApp via internal bridge
    const phoneDigits = rawPhone.replace(/\D/g, "");
    const to = phoneDigits.startsWith("55") ? `+${phoneDigits}` : `+55${phoneDigits}`;

    const smsRes = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ to, message, channel: "whatsapp" }),
    });
    const smsData = await smsRes.json().catch(() => ({}));
    const success = !!smsData?.whatsapp?.success;

    const kind = mode === "test" ? "test" : mode === "expiry_alert" ? "expiry_alert" : "daily";

    await sb.from("label_sms_logs").insert({
      restaurant_id: emp.restaurant_id,
      employee_id: emp.id,
      phone: to,
      message,
      kind,
      status: success ? "sent" : "failed",
      error: success ? null : (smsData?.whatsapp?.error || smsData?.message || smsData?.error || "Falha no envio por WhatsApp"),
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
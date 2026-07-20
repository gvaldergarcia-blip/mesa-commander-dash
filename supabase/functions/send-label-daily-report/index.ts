import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PANEL_URL = "https://app.mesaclik.com.br/etiquetas";
const MAX_LEN = 1200; // ~8 segmentos SMS — relatório completo
const DEFAULT_LABEL_ALERT_TEMPLATE_SID = "HX1207153b6f2d0899e229d61123f8712e";

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
      .select("id, product_name, expiry_date, status, label_product_id, product:label_product_id ( category, storage_location )")
      .eq("restaurant_id", emp.restaurant_id)
      .neq("status", "discharged")
      .limit(1000);

    const inSector = (l: any) => {
      if (!sectors.length) return true;
      const cat = l.product?.category;
      return cat && sectors.includes(cat);
    };

    const relevant = (labels || []).filter(inSector);

    // Products marked as "falta" for reposição (mesmos setores do funcionário)
    const { data: missing } = await sb
      .from("product_stock_status")
      .select("product_id, sector, product:product_id ( name, category, storage_location )")
      .eq("restaurant_id", emp.restaurant_id)
      .eq("status", "falta");
    const missingList = (missing || [])
      .filter((m: any) => {
        if (!sectors.length) return true;
        const cat = m.product?.category || m.sector;
        return cat && sectors.includes(cat);
      })
      .map((m: any) => ({
        name: m.product?.name || "Produto",
        sector: m.product?.category || m.sector || "Sem setor",
      }));
    const fmtHora = (d: Date) =>
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const fmtDia = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

    const expiredList: { name: string; exp: Date; sector: string }[] = [];
    const todayList: { name: string; exp: Date; sector: string }[] = [];
    const next24hList: { name: string; exp: Date; sector: string }[] = [];
    for (const l of relevant) {
      const exp = new Date(l.expiry_date);
      const sector = l.product?.category || "Sem setor";
      if (exp <= now) expiredList.push({ name: l.product_name, exp, sector });
      else if (exp <= endOfToday) todayList.push({ name: l.product_name, exp, sector });
      else if (exp <= in24h) next24hList.push({ name: l.product_name, exp, sector });
    }
    expiredList.sort((a, b) => a.exp.getTime() - b.exp.getTime());
    todayList.sort((a, b) => a.exp.getTime() - b.exp.getTime());
    next24hList.sort((a, b) => a.exp.getTime() - b.exp.getTime());

    const firstName = emp.name.split(" ")[0];

    // Agrupa por produto+setor (evita listar cada etiqueta individualmente)
    const groupCount = (arr: { name: string; sector: string }[]) => {
      const m = new Map<string, { name: string; sector: string; qty: number }>();
      for (const it of arr) {
        const k = `${it.name}::${it.sector}`;
        const prev = m.get(k);
        if (prev) prev.qty++;
        else m.set(k, { name: it.name, sector: it.sector, qty: 1 });
      }
      return Array.from(m.values());
    };

    const descartar = [...groupCount(expiredList), ...groupCount(todayList)];
    const reposicao = missingList;

    const linhas: string[] = [];
    if (mode === "test") linhas.push("[MESACLIK] Teste");
    else if (mode === "expiry_alert") linhas.push("🚨 MESACLIK");
    else linhas.push("[MESACLIK]");
    linhas.push("");
    if (mode === "expiry_alert") {
      const t = expiredList[0];
      linhas.push(`1 etiqueta venceu agora.`);
      linhas.push("");
      if (t) {
        linhas.push(`Produto:`);
        linhas.push(t.name);
        linhas.push("");
        linhas.push(`📍 ${t.sector}`);
        linhas.push("");
      }
      linhas.push("Realize a baixa imediatamente.");
    } else {
      linhas.push(`Bom dia, ${firstName}!`);
      linhas.push("");
      if (sectors.length) {
        linhas.push(`📍 Seus setores:`);
        for (const s of sectors) linhas.push(`• ${s}`);
      } else {
        linhas.push(`📍 Todos os setores`);
      }
      linhas.push("");
      linhas.push(`Resumo de hoje`);
      linhas.push("");
      linhas.push(`🚨 Vencidas: ${expiredList.length}`);
      linhas.push(`⏰ Vencem hoje: ${todayList.length}`);
      linhas.push(`📦 Precisam repor: ${reposicao.length}`);
      if (descartar.length) {
        linhas.push("");
        linhas.push(`Descartar agora`);
        for (const it of descartar.slice(0, 8)) {
          linhas.push("");
          linhas.push(`• ${it.name}${it.qty > 1 ? ` (${it.qty})` : ""}`);
          linhas.push(`📍 ${it.sector}`);
        }
        if (descartar.length > 8) linhas.push(`\n+ ${descartar.length - 8} outros`);
      }
      if (reposicao.length) {
        linhas.push("");
        linhas.push(`Reposição`);
        for (const it of reposicao.slice(0, 8)) {
          linhas.push("");
          linhas.push(`• ${it.name}`);
          linhas.push(`📍 ${it.sector}`);
        }
        if (reposicao.length > 8) linhas.push(`\n+ ${reposicao.length - 8} outros`);
      }
      if (!descartar.length && !reposicao.length) {
        linhas.push("");
        linhas.push("Tudo em ordem ✅");
      }
    }
    linhas.push("");
    linhas.push(`Painel:`);
    linhas.push(PANEL_URL);

    const message = trim(linhas.join("\n"));

    // Send WhatsApp + SMS fallback via internal bridge. SMS must continue even when WhatsApp template delivery fails.
    const phoneDigits = rawPhone.replace(/\D/g, "");
    const to = phoneDigits.startsWith("55") ? `+${phoneDigits}` : `+55${phoneDigits}`;

    // For WhatsApp tests/expiry alerts, use approved template (mandatory outside 24h window)
    let smsBody: Record<string, unknown> = { to, message, channel: "both" };

    if (mode === "test" || (mode === "expiry_alert" && triggered_label_id)) {
      const templateSid = Deno.env.get("TWILIO_WA_TEMPLATE_ETIQUETA_ALERTA") || DEFAULT_LABEL_ALERT_TEMPLATE_SID;
      let triggered: any = relevant.find((l: any) => l.id === triggered_label_id)
        || expiredList[0] || todayList[0] || next24hList[0];
      if (mode === "expiry_alert" && triggered_label_id && !triggered) {
        const { data: t } = await sb
          .from("label_issuances")
          .select("id, product_name, expiry_date")
          .eq("id", triggered_label_id)
          .maybeSingle();
        if (t) triggered = { name: t.product_name, exp: new Date(t.expiry_date) };
      }

      if (templateSid) {
        const productName = mode === "test"
          ? "Teste MesaClik"
          : (triggered as any)?.name || (triggered as any)?.product_name || "produto";
        const exp = mode === "test"
          ? now
          : (triggered as any)?.exp instanceof Date
          ? (triggered as any).exp
          : new Date((triggered as any).expiry_date);
        const diffMin = Math.round((exp.getTime() - now.getTime()) / 60000);
        const tempo = mode === "test"
          ? "agora (mensagem de teste)"
          : diffMin <= 0
          ? `agora (venceu às ${fmtHora(exp)})`
          : diffMin < 60
          ? `${diffMin}min`
          : `${Math.round(diffMin / 60)}h`;

        smsBody = {
          to,
          message,
          channel: "both",
          contentSid: templateSid,
          contentVariables: {
            "1": firstName,
            "2": String(productName).slice(0, 60),
            "3": tempo,
          },
        };
      }
    }

    const smsRes = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(smsBody),
    });
    const smsData = await smsRes.json().catch(() => ({}));
    const success = !!(smsData?.whatsapp?.success || smsData?.sms?.success);

    const kind = mode === "test" ? "test" : mode === "expiry_alert" ? "expiry_alert" : "daily";

    const whatsappError = smsData?.whatsapp?.success ? null : smsData?.whatsapp?.error;

    await sb.from("label_sms_logs").insert({
      restaurant_id: emp.restaurant_id,
      employee_id: emp.id,
      phone: to,
      message,
      kind,
      status: success ? "sent" : "failed",
      error: whatsappError || (!success ? (smsData?.sms?.error || smsData?.message || smsData?.error || "Falha no envio por SMS/WhatsApp") : null),
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
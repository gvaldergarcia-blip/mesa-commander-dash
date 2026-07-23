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

    const now = new Date();
    const in3d = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

    // Prepare recipient phone early (used for dedupe)
    const phoneDigits = rawPhone.replace(/\D/g, "");
    const to = phoneDigits.startsWith("55") ? `+${phoneDigits}` : `+55${phoneDigits}`;

    const { data: labels } = await sb
      .from("label_issuances")
      .select("id, product_name, expiry_date, status, label_product_id, product:label_product_id ( storage_location, category )")
      .eq("restaurant_id", emp.restaurant_id)
      .neq("status", "discharged")
      .limit(5000);

    const relevant = labels || [];

    // Produtos marcados como "falta" (críticos)
    const { data: missing } = await sb
      .from("product_stock_status")
      .select("product_id, sector, product:product_id ( name, storage_location, category )")
      .eq("restaurant_id", emp.restaurant_id)
      .eq("status", "falta");

    // Agrupa por produto+setor (uma linha por produto, com quantidade)
    type Group = { key: string; name: string; sector: string; qty: number };
    const groupBy = (arr: any[]): Group[] => {
      const m = new Map<string, Group>();
      for (const l of arr) {
        const sector = l.product?.storage_location || l.product?.category || "Sem setor";
        const key = `${l.label_product_id || l.product_name}::${sector}`;
        const prev = m.get(key);
        if (prev) prev.qty++;
        else m.set(key, { key, name: l.product_name, sector, qty: 1 });
      }
      return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
    };

    const expired = relevant.filter((l: any) => new Date(l.expiry_date) <= now);
    const soon = relevant.filter((l: any) => {
      const exp = new Date(l.expiry_date);
      return exp > now && exp <= in3d;
    });
    const expiredGroups = groupBy(expired);
    const soonGroups = groupBy(soon);
    const criticos = (missing || []).length;

    const linhas: string[] = [];
    if (mode === "test") {
      linhas.push("[MESACLIK] Teste");
      linhas.push("");
      linhas.push("Este é um envio de teste do sistema de alertas.");
      linhas.push("Números reais de hoje:");
      linhas.push(`🔴 ${expiredGroups.length} vencidos`);
      linhas.push(`🟠 ${soonGroups.length} vencem em até 3 dias`);
      linhas.push(`🟡 ${criticos} críticos`);
    } else if (mode === "expiry_alert") {
      // Compat: mantém envio individual caso ainda seja chamado
      linhas.push("🚨 MESACLIK");
      linhas.push("");
      linhas.push("Alerta imediato de vencimento.");
      const t = expiredGroups[0] || soonGroups[0];
      if (t) {
        linhas.push("");
        linhas.push(`• ${t.name}`);
        linhas.push(`📍 ${t.sector}`);
      }
      linhas.push("");
      linhas.push("Realize a baixa imediatamente.");
    } else {
      linhas.push("📋 Resumo MesaClik");
      linhas.push("");
      linhas.push("Hoje:");
      linhas.push(`🔴 ${expiredGroups.length} produto${expiredGroups.length === 1 ? "" : "s"} vencido${expiredGroups.length === 1 ? "" : "s"}`);
      linhas.push(`🟠 ${soonGroups.length} vence${soonGroups.length === 1 ? "" : "m"} em até 3 dias`);
      linhas.push(`🟡 ${criticos} produto${criticos === 1 ? "" : "s"} crítico${criticos === 1 ? "" : "s"}`);
      if (expiredGroups.length) {
        linhas.push("");
        linhas.push("🔴 Vencidos:");
        for (const g of expiredGroups.slice(0, 6)) {
          linhas.push(`• ${g.name}${g.qty > 1 ? ` (${g.qty})` : ""} — 📍 ${g.sector}`);
        }
        if (expiredGroups.length > 6) linhas.push(`…e mais ${expiredGroups.length - 6}.`);
      }
      if (soonGroups.length && expiredGroups.length + soonGroups.length <= 12) {
        linhas.push("");
        linhas.push("🟠 Próximos 3 dias:");
        for (const g of soonGroups.slice(0, 6)) {
          linhas.push(`• ${g.name}${g.qty > 1 ? ` (${g.qty})` : ""} — 📍 ${g.sector}`);
        }
        if (soonGroups.length > 6) linhas.push(`…e mais ${soonGroups.length - 6}.`);
      }
      if (!expiredGroups.length && !soonGroups.length && !criticos) {
        linhas.push("");
        linhas.push("Tudo em ordem ✅");
      }
    }
    linhas.push("");
    linhas.push("Acesse o painel para agir:");
    linhas.push(PANEL_URL);

    const message = trim(linhas.join("\n"));

    // Dedupe: 1 SMS de resumo por telefone por dia
    if (mode === "scheduled") {
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const { data: dup } = await sb
        .from("label_sms_logs")
        .select("id")
        .eq("restaurant_id", emp.restaurant_id)
        .eq("phone", to)
        .eq("kind", "daily")
        .eq("status", "sent")
        .gte("sent_at", startOfDay.toISOString())
        .limit(1);
      if ((dup || []).length > 0) {
        return new Response(JSON.stringify({ success: true, skipped: "already_sent_today" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const smsBody: Record<string, unknown> = { to, message, channel: "both" };

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
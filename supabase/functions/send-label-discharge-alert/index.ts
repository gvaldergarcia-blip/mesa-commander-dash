import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REASON_LABEL: Record<string, string> = {
  use: "Baixa por uso",
  consumo: "Baixa por uso",
  loss: "Baixa por perda",
  vencimento: "Baixa por vencimento",
  descarte: "Baixa por descarte",
  error: "Baixa por erro",
  outro: "Baixa (outro)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const {
      restaurant_id,
      label_id,
      product_name,
      product_id,
      reason,
      units,
      units_remaining,
      fully_discharged,
      employee_name,
    } = body || {};

    if (!restaurant_id || !product_name) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Setor do produto (para filtrar destinatários por setor)
    let sector: string | null = null;
    if (product_id) {
      const { data: prod } = await sb
        .from("label_products")
        .select("storage_location, category")
        .eq("id", product_id)
        .maybeSingle();
      sector = (prod as any)?.storage_location || (prod as any)?.category || null;
    }

    const { data: emps } = await sb
      .from("label_employees")
      .select("id, name, whatsapp_phone, sectors, sms_immediate_alerts, status")
      .eq("restaurant_id", restaurant_id)
      .eq("status", "active")
      .not("whatsapp_phone", "is", null);

    const recipients = (emps || []).filter((e: any) => {
      if (e.sms_immediate_alerts === false) return false;
      if (!sector) return true;
      if (!e.sectors?.length) return true;
      return e.sectors.includes(sector);
    });

    if (!recipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reasonLabel = REASON_LABEL[String(reason || "").toLowerCase()] || "Baixa registrada";
    const linhas = [
      "[MESACLIK]",
      "",
      `📉 ${reasonLabel}`,
      "",
      "Produto:",
      product_name,
      "",
      `Unidades baixadas: ${units || 1}`,
      fully_discharged
        ? "Etiqueta finalizada (todas as unidades usadas)"
        : `Restam: ${units_remaining ?? 0} unidade(s)`,
    ];
    if (sector) {
      linhas.push("", "📍 Local:", sector);
    }
    if (employee_name) {
      linhas.push("", "Responsável:", employee_name);
    }
    if (fully_discharged) {
      linhas.push("", "⚠️ Verifique se este produto precisa de reposição.");
    }
    const message = linhas.join("\n");

    const results: any[] = [];
    for (const t of recipients) {
      const digits = String((t as any).whatsapp_phone).replace(/\D/g, "");
      const to = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ to, message, channel: "both" }),
        });
        const d = await r.json().catch(() => ({}));
        const ok = !!(d?.whatsapp?.success || d?.sms?.success);
        await sb.from("label_sms_logs").insert({
          restaurant_id,
          employee_id: (t as any).id,
          phone: to,
          message,
          kind: "manual",
          status: ok ? "sent" : "failed",
          error: ok ? null : d?.message || d?.error || "falha",
          triggered_label_id: label_id ?? null,
        });
        results.push({ to: (t as any).name, ok });
      } catch (err: any) {
        results.push({ to: (t as any).name, ok: false, error: err?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
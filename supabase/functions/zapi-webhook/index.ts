import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { zapiSendText } from "../_shared/zapi.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PANEL_URL = "https://app.mesaclik.com.br/etiquetas";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function digits(p: string) {
  return String(p || "").replace(/\D/g, "");
}

function extract(payload: any) {
  const phone = payload?.phone || payload?.participantPhone || payload?.sender || "";
  const text =
    payload?.text?.message ??
    payload?.message?.text ??
    payload?.body ??
    payload?.text ??
    "";
  return {
    phone: digits(phone),
    body: typeof text === "string" ? text.trim() : "",
    messageId: payload?.messageId || payload?.id || payload?.zaapId || null,
    fromMe: !!payload?.fromMe,
    status: payload?.status || null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  // Webhook secret travels in the URL (?s=...) — Z-API cannot send custom headers.
  const secret = Deno.env.get("ZAPI_WEBHOOK_SECRET")?.trim();
  const provided = new URL(req.url).searchParams.get("s");
  if (!secret || provided !== secret) return ok({ error: "unauthorized" }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const payload = await req.json().catch(() => ({}));
  const msg = extract(payload);

  // Delivery/status callbacks: update the outbound log only.
  if (msg.status && !msg.body) {
    if (msg.messageId) {
      await sb.from("label_sms_logs")
        .update({ status: String(msg.status).toLowerCase() })
        .eq("provider_message_id", msg.messageId);
    }
    return ok({ received: "status" });
  }

  if (msg.fromMe || !msg.phone) return ok({ ignored: true });

  // Identify sender — only registered, active employees may interact.
  const tail = msg.phone.slice(-8);
  const { data: emps } = await sb
    .from("label_employees")
    .select("id, name, restaurant_id, whatsapp_phone, status, notifications_enabled")
    .eq("status", "active")
    .not("whatsapp_phone", "is", null)
    .limit(2000);
  const employee = (emps || []).find((e: any) => digits(e.whatsapp_phone).endsWith(tail)) || null;

  let reply: string | null = null;

  if (!employee) {
    reply = "Número não reconhecido pelo MesaClik. Peça ao administrador para cadastrar seu WhatsApp.";
  } else {
    const text = msg.body.toLowerCase();
    if (text === "1" || text.includes("sim") || text.includes("validade")) {
      const now = new Date();
      const in2d = new Date(now.getTime() + 2 * 86400000);
      const { data: labels } = await sb
        .from("label_issuances")
        .select("product_name, expiry_date, product:label_product_id ( storage_location, category )")
        .eq("restaurant_id", employee.restaurant_id)
        .neq("status", "discharged")
        .gte("expiry_date", now.toISOString())
        .lte("expiry_date", in2d.toISOString())
        .order("expiry_date")
        .limit(15);
      if (!labels?.length) {
        reply = "✅ MESACLIK\n\nNenhum produto vencendo nas próximas 48h.";
      } else {
        const lines = ["⚠️ MESACLIK — VALIDADE", ""];
        labels.forEach((l: any, i: number) => {
          const local = new Date(l.expiry_date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          lines.push(`${i + 1}. ${l.product_name} — ${local}`);
        });
        lines.push("", PANEL_URL);
        reply = lines.join("\n");
      }
    } else if (text === "2" || text.includes("não") || text.includes("nao")) {
      reply = "Ok! Qualquer coisa é só chamar. 👍";
    } else {
      reply = `Olá, ${employee.name.split(" ")[0]}! 👋\n\nResponda:\n1 - Ver produtos vencendo\n2 - Encerrar\n\nPainel: ${PANEL_URL}`;
    }
  }

  await sb.from("whatsapp_inbound_messages").insert({
    restaurant_id: employee?.restaurant_id ?? null,
    employee_id: employee?.id ?? null,
    phone: `+${msg.phone}`,
    body: msg.body,
    provider_message_id: msg.messageId,
    authorized: !!employee,
    handled: true,
    reply,
    raw: payload,
  });

  if (reply) await zapiSendText(msg.phone, reply);

  return ok({ received: true, authorized: !!employee });
});
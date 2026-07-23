import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PANEL_URL = "https://app.mesaclik.com.br/etiquetas";
const MAX_ITEMS = 8;

type Group = {
  product_id: string | null;
  product_name: string;
  sector: string;
  qty: number;
};

async function eventAlreadySent(sb: any, restaurant_id: string, event_key: string) {
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
  const { data } = await sb
    .from("label_sms_logs")
    .select("id")
    .eq("restaurant_id", restaurant_id)
    .eq("kind", "expiry_group")
    .eq("status", "sent")
    .gte("sent_at", since)
    .ilike("error", `evt:${event_key}%`)
    .limit(1);
  return (data || []).length > 0;
}

function buildGroups(labels: any[]): Group[] {
  const map = new Map<string, Group>();
  for (const l of labels) {
    const sector = l.product?.storage_location || l.product?.category || "Sem setor";
    const key = `${l.label_product_id || l.product_name}::${sector}`;
    const prev = map.get(key);
    if (prev) prev.qty++;
    else map.set(key, { product_id: l.label_product_id, product_name: l.product_name, sector, qty: 1 });
  }
  return Array.from(map.values()).sort((a, b) => a.product_name.localeCompare(b.product_name));
}

function renderMessage(kind: "expired" | "soon", groups: Group[]): { message: string; event_key: string } {
  const total = groups.reduce((s, g) => s + g.qty, 0);
  const uniq = groups.length;
  const heading = kind === "expired"
    ? `🚨 MESACLIK\n\n${uniq} produto${uniq === 1 ? "" : "s"} venceu${uniq === 1 ? "" : "ram"} agora.`
    : `⚠️ MESACLIK\n\n${uniq} produto${uniq === 1 ? "" : "s"} vence${uniq === 1 ? "" : "m"} em até 3 dias.`;
  const lines: string[] = [heading, ""];
  for (const g of groups.slice(0, MAX_ITEMS)) {
    lines.push(`• ${g.product_name}`);
    lines.push(`📍 ${g.sector}`);
    if (g.qty > 1) lines.push(`${g.qty} etiquetas${kind === "expired" ? " vencidas" : ""}`);
    lines.push("");
  }
  if (uniq > MAX_ITEMS) lines.push(`…e mais ${uniq - MAX_ITEMS} produto${uniq - MAX_ITEMS === 1 ? "" : "s"}.\n`);
  lines.push(kind === "expired" ? "Acesse o painel para realizar as baixas." : "Verifique esses produtos antes do vencimento.");
  lines.push(PANEL_URL);
  const message = lines.join("\n");
  // Event key based on kind, day, and sorted product+sector list
  const day = new Date().toISOString().slice(0, 10);
  const sig = groups.map((g) => `${g.product_id || g.product_name}|${g.sector}|${g.qty}`).sort().join(";");
  let hash = 0;
  for (let i = 0; i < sig.length; i++) hash = ((hash << 5) - hash + sig.charCodeAt(i)) | 0;
  const event_key = `${kind}:${day}:${(hash >>> 0).toString(36)}:t${total}u${uniq}`;
  return { message, event_key };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({} as any));
    const targetRestaurant: string | null = body?.restaurant_id || null;

    const now = new Date();
    const in3d = new Date(now.getTime() + 3 * 24 * 3600 * 1000);

    // Pull all non-discharged labels expiring up to +3d (or already expired)
    let q = sb
      .from("label_issuances")
      .select("id, restaurant_id, product_name, expiry_date, status, label_product_id, product:label_product_id ( category, storage_location )")
      .neq("status", "discharged")
      .lte("expiry_date", in3d.toISOString())
      .limit(5000);
    if (targetRestaurant) q = q.eq("restaurant_id", targetRestaurant);
    const { data: labels } = await q;

    if (!labels?.length) {
      return new Response(JSON.stringify({ count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by restaurant, then bucket
    const byRest = new Map<string, any[]>();
    labels.forEach((l: any) => {
      const arr = byRest.get(l.restaurant_id) || [];
      arr.push(l); byRest.set(l.restaurant_id, arr);
    });

    const results: any[] = [];
    for (const [restaurantId, restLabels] of byRest) {
      const expired: any[] = [];
      const soon: any[] = [];
      for (const l of restLabels) {
        const exp = new Date(l.expiry_date);
        if (exp <= now) expired.push(l);
        else if (exp <= in3d) soon.push(l);
      }

      // Recipients: one message per phone per event
      const { data: emps } = await sb
        .from("label_employees")
        .select("id, name, whatsapp_phone, sms_immediate_alerts, status")
        .eq("restaurant_id", restaurantId)
        .eq("status", "active")
        .eq("sms_immediate_alerts", true)
        .not("whatsapp_phone", "is", null);
      if (!emps?.length) continue;

      const phones = new Map<string, { id: string; phone: string }>();
      for (const e of emps) {
        const digits = String(e.whatsapp_phone).replace(/\D/g, "");
        if (!digits) continue;
        const to = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
        if (!phones.has(to)) phones.set(to, { id: e.id, phone: to });
      }

      for (const [kind, list] of [["expired", expired], ["soon", soon]] as const) {
        if (!list.length) continue;
        const groups = buildGroups(list);
        if (!groups.length) continue;
        const { message, event_key } = renderMessage(kind, groups);
        if (await eventAlreadySent(sb, restaurantId, event_key)) {
          results.push({ restaurant_id: restaurantId, kind, skipped: "already_sent", event_key });
          continue;
        }
        for (const { id: employee_id, phone: to } of phones.values()) {
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({ to, message, channel: "both" }),
            });
            const data = await r.json().catch(() => ({}));
            const success = !!(data?.whatsapp?.success || data?.sms?.success);
            await sb.from("label_sms_logs").insert({
              restaurant_id: restaurantId,
              employee_id,
              phone: to,
              message,
              kind: "expiry_group",
              status: success ? "sent" : "failed",
              error: success ? `evt:${event_key}` : (data?.whatsapp?.error || data?.sms?.error || "falha"),
            });
            results.push({ restaurant_id: restaurantId, kind, to, success });
          } catch (e: any) {
            results.push({ restaurant_id: restaurantId, kind, to, error: e.message });
          }
        }
      }
    }

    return new Response(JSON.stringify({ count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
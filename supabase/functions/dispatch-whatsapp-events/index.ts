import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PANEL_URL = "https://app.mesaclik.com.br/etiquetas";
const MAX_ITEMS = 8;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function notify(payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notify-whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(payload),
  });
  return await res.json().catch(() => ({}));
}

function today() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

type Item = { name: string; sector: string; qty: number };

function groupLabels(labels: any[]): Item[] {
  const map = new Map<string, Item>();
  for (const l of labels) {
    const sector = l.product?.storage_location || l.product?.category || "Sem setor";
    const key = `${l.product_name}::${sector}`;
    const prev = map.get(key);
    if (prev) prev.qty++;
    else map.set(key, { name: l.product_name, sector, qty: 1 });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renderValidity(kind: "today" | "tomorrow" | "soon", items: Item[]) {
  const head = kind === "today"
    ? "⚠️ MESACLIK — VALIDADE\n\nProdutos que vencem hoje:"
    : kind === "tomorrow"
      ? "⚠️ MESACLIK — VALIDADE\n\nProdutos que vencem amanhã:"
      : "⚠️ MESACLIK — VALIDADE\n\nProdutos próximos do vencimento (3 dias):";
  const lines = [head, ""];
  for (const i of items.slice(0, MAX_ITEMS)) {
    lines.push(`• ${i.name}${i.qty > 1 ? ` (${i.qty} etiquetas)` : ""}`);
    lines.push(`📍 ${i.sector}`);
  }
  if (items.length > MAX_ITEMS) lines.push(`…e mais ${items.length - MAX_ITEMS} produto(s).`);
  lines.push("", "Acesse o MesaClik para verificar.", PANEL_URL);
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({} as any));
    const only: string | null = body?.restaurant_id || null;

    const { data: settingsRows } = await sb
      .from("whatsapp_notification_settings")
      .select("restaurant_id, enabled, events")
      .eq("enabled", true);

    const restaurants = (settingsRows || [])
      .filter((s: any) => !only || s.restaurant_id === only)
      .map((s: any) => s);

    const out: any[] = [];
    const now = new Date();
    const in3d = new Date(now.getTime() + 3 * 86400000);

    for (const s of restaurants) {
      const rid = s.restaurant_id;
      const events = s.events || {};

      // ---------- VALIDADE ----------
      if (events.validity_today || events.validity_tomorrow || events.validity_soon) {
        const { data: labels } = await sb
          .from("label_issuances")
          .select("product_name, expiry_date, status, product:label_product_id ( category, storage_location )")
          .eq("restaurant_id", rid)
          .neq("status", "discharged")
          .gte("expiry_date", now.toISOString())
          .lte("expiry_date", in3d.toISOString())
          .limit(3000);

        const buckets: Record<"today" | "tomorrow" | "soon", any[]> = { today: [], tomorrow: [], soon: [] };
        const d0 = today();
        const d1 = new Date(Date.now() + 86400000 - 3 * 3600 * 1000).toISOString().slice(0, 10);
        for (const l of labels || []) {
          const day = new Date(l.expiry_date).toISOString().slice(0, 10);
          if (day === d0) buckets.today.push(l);
          else if (day === d1) buckets.tomorrow.push(l);
          else buckets.soon.push(l);
        }

        for (const kind of ["today", "tomorrow", "soon"] as const) {
          const flag = kind === "today" ? "validity_today" : kind === "tomorrow" ? "validity_tomorrow" : "validity_soon";
          if (!events[flag]) continue;
          const items = groupLabels(buckets[kind]);
          if (!items.length) continue;
          out.push(await notify({
            restaurant_id: rid,
            event_type: flag,
            message: renderValidity(kind, items),
            dedupe_key: `${flag}:${d0}`,
            payload: { items: items.slice(0, 20) },
          }));
        }
      }

      // ---------- ESTOQUE ----------
      if (events.stock_out || events.stock_below_min || events.stock_replenish) {
        const { data: stock } = await sb
          .from("product_stock_status")
          .select("status, sector, product:product_id ( name, storage_location )")
          .eq("restaurant_id", rid)
          .in("status", ["out", "replenish", "attention", "low"])
          .limit(500);

        const critical = (stock || []).filter((r: any) => ["out", "replenish"].includes(r.status));
        const low = (stock || []).filter((r: any) => ["attention", "low"].includes(r.status));

        if (events.stock_out && critical.length) {
          const lines = ["🔴 MESACLIK — ESTOQUE", "", "Produtos que precisam de reposição:", ""];
          for (const r of critical.slice(0, MAX_ITEMS)) {
            lines.push(`• ${r.product?.name || "Produto"}`);
            lines.push(`📍 ${r.sector || r.product?.storage_location || "Sem setor"}`);
          }
          if (critical.length > MAX_ITEMS) lines.push(`…e mais ${critical.length - MAX_ITEMS} produto(s).`);
          lines.push("", "Acesse o MesaClik para revisar.", PANEL_URL);
          out.push(await notify({
            restaurant_id: rid,
            event_type: "stock_out",
            message: lines.join("\n"),
            dedupe_key: `stock_out:${today()}`,
          }));
        }

        if (events.stock_below_min && low.length) {
          const lines = ["🟠 MESACLIK — ESTOQUE", "", "Produtos em atenção (abaixo do ideal):", ""];
          for (const r of low.slice(0, MAX_ITEMS)) {
            lines.push(`• ${r.product?.name || "Produto"}`);
            lines.push(`📍 ${r.sector || r.product?.storage_location || "Sem setor"}`);
          }
          if (low.length > MAX_ITEMS) lines.push(`…e mais ${low.length - MAX_ITEMS} produto(s).`);
          lines.push("", "Acesse o MesaClik para revisar.", PANEL_URL);
          out.push(await notify({
            restaurant_id: rid,
            event_type: "stock_below_min",
            message: lines.join("\n"),
            dedupe_key: `stock_below_min:${today()}`,
          }));
        }
      }

      // ---------- RECEBIMENTO ----------
      if (events.receipt_pending || events.receipt_awaiting_info) {
        const { count: drafts } = await sb
          .from("label_receipt_drafts")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", rid)
          .is("finalized_receipt_id", null);

        if (events.receipt_pending && (drafts || 0) > 0) {
          out.push(await notify({
            restaurant_id: rid,
            event_type: "receipt_pending",
            message: `📦 MESACLIK — RECEBIMENTO\n\nExistem ${drafts} recebimento(s) pendente(s) de confirmação.\n\nAcesse o MesaClik para revisar.\n${PANEL_URL}`,
            dedupe_key: `receipt_pending:${today()}`,
          }));
        }

        const { count: needInfo } = await sb
          .from("label_receipt_items")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", rid)
          .eq("needs_info", true);

        if (events.receipt_awaiting_info && (needInfo || 0) > 0) {
          out.push(await notify({
            restaurant_id: rid,
            event_type: "receipt_awaiting_info",
            message: `📦 MESACLIK — RECEBIMENTO\n\nExistem ${needInfo} produto(s) recebidos aguardando informação.\n\nAcesse o MesaClik para completar.\n${PANEL_URL}`,
            dedupe_key: `receipt_awaiting_info:${today()}`,
          }));
        }
      }
    }

    return json({ restaurants: restaurants.length, dispatched: out.length, out });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
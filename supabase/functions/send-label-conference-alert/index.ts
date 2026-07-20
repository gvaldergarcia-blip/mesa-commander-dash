import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PANEL_URL = "https://app.mesaclik.com.br/etiquetas";

// Envia alerta ao(s) funcionário(s) responsável(is) quando um setor ainda não foi
// conferido no dia corrente. Considera "conferido" qualquer registro em
// product_stock_status atualizado a partir de hoje 00:00 no setor.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const restaurantId: string | undefined = body.restaurant_id;

    let restaurantIds: string[] = [];
    if (restaurantId) restaurantIds = [restaurantId];
    else {
      const { data } = await sb.from("restaurants").select("id");
      restaurantIds = (data || []).map((r: any) => r.id);
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const results: any[] = [];

    for (const rid of restaurantIds) {
      // Produtos ativos por setor (via label_products com etiquetas ativas)
      const { data: activeLabels } = await sb
        .from("label_issuances")
        .select("label_product_id, product:label_product_id (id, category, storage_location)")
        .eq("restaurant_id", rid)
        .neq("status", "discharged")
        .limit(2000);
      const productsBySector = new Map<string, Set<string>>();
      for (const l of activeLabels || []) {
        const p: any = (l as any).product;
        if (!p?.id) continue;
        const sec = p.category || p.storage_location || "Sem setor";
        if (!productsBySector.has(sec)) productsBySector.set(sec, new Set());
        productsBySector.get(sec)!.add(p.id);
      }

      // Checagens de hoje
      const { data: checks } = await sb
        .from("product_stock_status")
        .select("product_id, sector, marked_at")
        .eq("restaurant_id", rid)
        .gte("marked_at", startOfDay.toISOString());
      const checkedBySector = new Map<string, Set<string>>();
      for (const c of checks || []) {
        const sec = (c as any).sector || "Sem setor";
        if (!checkedBySector.has(sec)) checkedBySector.set(sec, new Set());
        checkedBySector.get(sec)!.add((c as any).product_id);
      }

      const pendingSectors: { sector: string; count: number }[] = [];
      for (const [sec, ids] of productsBySector) {
        const done = checkedBySector.get(sec) || new Set();
        const missing = Array.from(ids).filter((id) => !done.has(id)).length;
        if (missing > 0) pendingSectors.push({ sector: sec, count: missing });
      }
      if (!pendingSectors.length) { results.push({ rid, skipped: "sem pendências" }); continue; }

      const { data: emps } = await sb
        .from("label_employees")
        .select("id, name, whatsapp_phone, sectors")
        .eq("restaurant_id", rid).eq("status", "active")
        .not("whatsapp_phone", "is", null);

      for (const p of pendingSectors) {
        const targets = (emps || []).filter((e: any) =>
          !e.sectors?.length || e.sectors.includes(p.sector)
        );
        for (const t of targets) {
          const digits = String((t as any).whatsapp_phone).replace(/\D/g, "");
          const to = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
          const linhas = [
            "[MESACLIK]",
            "",
            "⚠️ A conferência ainda não foi realizada.",
            "",
            "Setor:",
            p.sector,
            "",
            "Produtos aguardando:",
            String(p.count),
            "",
            "Realize a conferência.",
            "",
            "Painel:",
            PANEL_URL,
          ];
          const message = linhas.join("\n");
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({ to, message, channel: "both" }),
            });
            const d = await r.json().catch(() => ({}));
            const ok = !!(d?.whatsapp?.success || d?.sms?.success);
            await sb.from("label_sms_logs").insert({
              restaurant_id: rid,
              employee_id: (t as any).id,
              phone: to,
              message,
              kind: "manual",
              status: ok ? "sent" : "failed",
              error: ok ? null : (d?.message || d?.error || "falha"),
            });
            results.push({ rid, to: (t as any).name, sector: p.sector, ok });
          } catch (e: any) {
            results.push({ rid, to: (t as any).name, error: e.message });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
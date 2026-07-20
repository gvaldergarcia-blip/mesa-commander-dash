import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PANEL_URL = "https://app.mesaclik.com.br/etiquetas";
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function topN(counter: Map<string, number>, n: number) {
  return Array.from(counter.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
}

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

    // Mês anterior (default) — ex.: rodando em 01/Ago envia relatório de Julho
    const now = new Date();
    const firstOfThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const label = `${MONTHS[firstOfPrev.getMonth()]}/${firstOfPrev.getFullYear()}`;
    const since = firstOfPrev.toISOString();
    const until = firstOfThis.toISOString();

    const results: any[] = [];

    for (const rid of restaurantIds) {
      const { count: receiptCount } = await sb.from("label_receipts")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", rid).gte("received_at", since).lt("received_at", until);

      const { count: issuedCount } = await sb.from("label_issuances")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", rid).gte("created_at", since).lt("created_at", until);

      const { data: discharges } = await sb.from("label_discharges")
        .select("id, quantity, label_issuance:label_issuance_id (product_name, label_product:label_product_id (category))")
        .eq("restaurant_id", rid).gte("discharged_at", since).lt("discharged_at", until);

      const productCounter = new Map<string, number>();
      const sectorCounter = new Map<string, number>();
      let unitCount = 0;
      const uniqueProducts = new Set<string>();
      for (const d of discharges || []) {
        const name = (d as any).label_issuance?.product_name || "Produto";
        const sector = (d as any).label_issuance?.label_product?.category || "Sem setor";
        const qty = Number((d as any).quantity || 1);
        productCounter.set(name, (productCounter.get(name) || 0) + qty);
        sectorCounter.set(sector, (sectorCounter.get(sector) || 0) + qty);
        uniqueProducts.add(name);
        unitCount += qty;
      }

      const { data: faltas } = await sb.from("stock_check_logs")
        .select("product_name").eq("restaurant_id", rid).eq("status", "falta")
        .gte("created_at", since).lt("created_at", until);
      const faltaCounter = new Map<string, number>();
      for (const f of faltas || []) {
        const n = (f as any).product_name || "Produto";
        faltaCounter.set(n, (faltaCounter.get(n) || 0) + 1);
      }

      const { data: chefs } = await sb.from("label_employees")
        .select("id, name, whatsapp_phone, role")
        .eq("restaurant_id", rid).eq("status", "active")
        .not("whatsapp_phone", "is", null);
      const targets = (chefs || []).filter((c: any) => {
        const r = (c.role || "").toLowerCase();
        return r.includes("gerente") || r.includes("admin") || r.includes("propriet") || r.includes("dono");
      });
      const finalTargets = targets.length ? targets : (chefs || []).slice(0, 1);
      if (!finalTargets.length) { results.push({ rid, skipped: "sem destinatário" }); continue; }

      const linhas: string[] = [];
      linhas.push("[MESACLIK]");
      linhas.push("");
      linhas.push("📊 Relatório Mensal");
      linhas.push("");
      linhas.push(label);
      linhas.push("");
      linhas.push(`Recebimentos: ${receiptCount || 0}`);
      linhas.push(`Etiquetas emitidas: ${issuedCount || 0}`);
      linhas.push(`Baixas por vencimento: ${(discharges || []).length}`);
      linhas.push(`Produtos descartados: ${uniqueProducts.size}`);
      linhas.push(`Unidades descartadas: ${unitCount}`);

      const topProd = topN(productCounter, 3);
      if (topProd.length) {
        linhas.push("");
        linhas.push("Produtos que mais venceram:");
        topProd.forEach(([n, q]) => linhas.push(`• ${n} (${q})`));
      }
      const topSectors = topN(sectorCounter, 3);
      if (topSectors.length) {
        linhas.push("");
        linhas.push("Setores com mais perdas:");
        topSectors.forEach(([s], i) => linhas.push(`${i + 1}. ${s}`));
      }
      const topFaltas = topN(faltaCounter, 3);
      if (topFaltas.length) {
        linhas.push("");
        linhas.push("Produtos que mais precisaram reposição:");
        topFaltas.forEach(([n], i) => linhas.push(`${i + 1}. ${n}`));
      }
      linhas.push("");
      linhas.push("Painel:");
      linhas.push(PANEL_URL);
      const message = linhas.join("\n").slice(0, 1500);

      for (const t of finalTargets) {
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
            restaurant_id: rid,
            employee_id: (t as any).id,
            phone: to,
            message,
            kind: "manual",
            status: ok ? "sent" : "failed",
            error: ok ? null : (d?.message || d?.error || "falha"),
          });
          results.push({ rid, to: (t as any).name, ok });
        } catch (e: any) {
          results.push({ rid, to: (t as any).name, error: e.message });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, month: label, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const now = new Date();
    const since = new Date(now.getTime() - 30 * 60 * 1000); // last 30 min

    // Labels that just expired (expiry_date between since and now), not discharged
    const { data: labels } = await sb
      .from("label_issuances")
      .select("id, restaurant_id, product_name, expiry_date, status, label_product_id, product:label_product_id ( category )")
      .neq("status", "discharged")
      .gte("expiry_date", since.toISOString())
      .lte("expiry_date", now.toISOString())
      .limit(500);

    if (!labels?.length) {
      return new Response(JSON.stringify({ count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already alerted?
    const ids = labels.map((l: any) => l.id);
    const { data: existing } = await sb
      .from("label_sms_logs")
      .select("triggered_label_id")
      .eq("kind", "expiry_alert")
      .in("triggered_label_id", ids);
    const alerted = new Set((existing || []).map((r: any) => r.triggered_label_id));

    const todo = labels.filter((l: any) => !alerted.has(l.id));
    if (!todo.length) {
      return new Response(JSON.stringify({ count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by restaurant for employee lookup
    const byRest = new Map<string, any[]>();
    todo.forEach((l: any) => {
      const arr = byRest.get(l.restaurant_id) || [];
      arr.push(l); byRest.set(l.restaurant_id, arr);
    });

    const results: any[] = [];
    for (const [restaurantId, restLabels] of byRest) {
      const { data: emps } = await sb
        .from("label_employees")
        .select("id, sectors, whatsapp_phone, sms_immediate_alerts, status")
        .eq("restaurant_id", restaurantId)
        .eq("status", "active")
        .eq("sms_immediate_alerts", true)
        .not("whatsapp_phone", "is", null);

      for (const lab of restLabels) {
        const cat = lab.product?.category;
        const targets = (emps || []).filter((e: any) =>
          !e.sectors?.length || (cat && e.sectors.includes(cat))
        );
        for (const emp of targets) {
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/send-label-daily-report`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({
                employee_id: emp.id,
                mode: "expiry_alert",
                triggered_label_id: lab.id,
              }),
            });
            results.push({ label: lab.id, employee: emp.id, status: r.status });
          } catch (e: any) {
            results.push({ label: lab.id, employee: emp.id, error: e.message });
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
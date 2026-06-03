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

    // Hour in America/Sao_Paulo (UTC-3, no DST since 2019)
    const now = new Date();
    const spHour = (now.getUTCHours() - 3 + 24) % 24;

    const { data: employees } = await sb
      .from("label_employees")
      .select("id, restaurant_id, name, sms_daily_hour, whatsapp_phone")
      .eq("status", "active")
      .eq("sms_daily_enabled", true)
      .eq("sms_daily_hour", spHour)
      .not("whatsapp_phone", "is", null);

    const results: any[] = [];
    for (const emp of employees || []) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/send-label-daily-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ employee_id: emp.id, mode: "scheduled" }),
        });
        results.push({ employee_id: emp.id, status: r.status });
      } catch (e: any) {
        results.push({ employee_id: emp.id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ hour_sp: spHour, count: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
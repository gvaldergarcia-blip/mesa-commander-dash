import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SRK);
    const body = await req.json();
    const suggestionId = String(body.suggestionId || "").slice(0, 36);
    const action = String(body.action || "approve"); // approve | dismiss
    if (!suggestionId) return new Response(JSON.stringify({ error: "suggestionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: sug } = await admin
      .from("social_post_suggestions")
      .select("id, restaurant_id, restaurants:restaurant_id(owner_id)")
      .eq("id", suggestionId)
      .maybeSingle();
    if (!sug) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if ((sug as any).restaurants?.owner_id !== user.id) {
      const { data: isAdm } = await admin.rpc("is_admin", { user_id: user.id });
      if (!isAdm) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const update = action === "dismiss"
      ? { status: "dismissed" as const }
      : { status: "approved" as const, approved_at: new Date().toISOString() };

    const { error } = await admin.from("social_post_suggestions").update(update).eq("id", suggestionId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ success: true, status: update.status }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
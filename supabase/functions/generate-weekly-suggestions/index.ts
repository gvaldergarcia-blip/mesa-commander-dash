import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Gera N sugestões semanais de posts para um restaurante.
 * Prioriza pratos com photo_url (reaproveita imagem existente) e rotaciona
 * pratos que não foram sugeridos recentemente.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const restaurantId: string | undefined = body.restaurant_id;
    if (!restaurantId) {
      return new Response(JSON.stringify({ error: "restaurant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Config do autopilot
    const { data: settings } = await sb
      .from("studio_autopilot_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    const target = Math.max(1, Math.min(10, settings?.weekly_target ?? 3));

    // Pratos ativos
    const { data: dishes } = await sb
      .from("menu_dishes")
      .select("id, name, description, category, photo_url")
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .limit(200);

    if (!dishes?.length) {
      return new Response(JSON.stringify({ error: "no_dishes" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pratos usados recentemente (últimos 30 dias)
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: recent } = await sb
      .from("studio_weekly_suggestions")
      .select("dish_id")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", since);
    const usedIds = new Set((recent || []).map((r: any) => r.dish_id).filter(Boolean));

    // Prioriza: (1) tem photo_url  (2) não usado nos últimos 30 dias
    const scored = dishes
      .map((d: any) => ({
        d,
        score: (d.photo_url ? 2 : 0) + (usedIds.has(d.id) ? -3 : 1) + Math.random(),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, target);

    const suggestions: any[] = [];
    for (let i = 0; i < scored.length; i++) {
      const d = scored[i].d;

      // Copy padrão (fallback) — usa AI se disponível
      let copy = `${d.name}${d.description ? ` — ${d.description.slice(0, 120)}` : ""}. Reserve o seu hoje!`;
      let hashtags = "#gastronomia #restaurante #foodlover";

      if (LOVABLE_API_KEY) {
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: "Você escreve legendas curtas para Instagram de restaurantes em português-BR. Máx 220 caracteres, tom acolhedor, sem clichês, sem emojis excessivos.",
                },
                {
                  role: "user",
                  content: `Prato: ${d.name}\nCategoria: ${d.category}\nDescrição: ${d.description || "—"}\n\nRetorne JSON: {"copy": "...", "hashtags": "#a #b #c"}`,
                },
              ],
            }),
          });
          if (aiRes.ok) {
            const j = await aiRes.json();
            const text = j.choices?.[0]?.message?.content || "";
            const m = text.match(/\{[\s\S]*\}/);
            if (m) {
              const parsed = JSON.parse(m[0]);
              if (parsed.copy) copy = parsed.copy;
              if (parsed.hashtags) hashtags = parsed.hashtags;
            }
          }
        } catch (_) { /* mantém fallback */ }
      }

      // Horário sugerido: distribui ao longo da semana às 19h
      const publishAt = new Date();
      publishAt.setDate(publishAt.getDate() + i + 1);
      publishAt.setHours(19, 0, 0, 0);

      const row = {
        restaurant_id: restaurantId,
        dish_id: d.id,
        dish_name: d.name,
        suggested_copy: `${copy}\n\n${hashtags}`,
        suggested_hashtags: hashtags,
        suggested_publish_at: publishAt.toISOString(),
        image_url: d.photo_url || null,
        status: "pending",
      };
      suggestions.push(row);
    }

    const { data: inserted, error } = await sb
      .from("studio_weekly_suggestions")
      .insert(suggestions)
      .select();
    if (error) throw error;

    await sb
      .from("studio_autopilot_settings")
      .upsert({ restaurant_id: restaurantId, last_generated_at: new Date().toISOString() });

    return new Response(JSON.stringify({ success: true, count: inserted?.length || 0, suggestions: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[generate-weekly-suggestions]", e);
    return new Response(JSON.stringify({ error: e.message || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
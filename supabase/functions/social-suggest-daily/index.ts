import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SRK);

    // Optional manual trigger: body { restaurantId } limits to one restaurant
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* cron call has no body */ }
    const onlyRestaurantId = body?.restaurantId ? String(body.restaurantId) : null;

    // Find eligible restaurants (autopilot ON)
    let q = admin.from("restaurants")
      .select("id, name, address, image_url, social_autopilot_enabled, social_autopilot_categories, cuisine, status")
      .eq("social_autopilot_enabled", true)
      .eq("status", "active");
    if (onlyRestaurantId) q = q.eq("id", onlyRestaurantId);
    const { data: restaurants, error: rErr } = await q;
    if (rErr) throw rErr;

    const results: any[] = [];
    const today = new Date();
    const dayName = DAYS_PT[today.getDay()];

    for (const r of restaurants || []) {
      try {
        // Skip if a pending/approved suggestion already exists for today
        const todayDate = new Date(today.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).toISOString().slice(0, 10);
        const { data: existing } = await admin
          .from("social_post_suggestions")
          .select("id")
          .eq("restaurant_id", r.id)
          .eq("suggested_for_date", todayDate)
          .in("status", ["pending", "approved"])
          .maybeSingle();
        if (existing) { results.push({ restaurant: r.id, skipped: "already_has_today" }); continue; }

        const enabledCategories = (r.social_autopilot_categories?.length ? r.social_autopilot_categories : ["prato_principal"]) as string[];

        // Pick a dish: featured + has photo + matches categories, rotate by last_used_at
        const { data: dishes } = await admin
          .from("restaurant_dishes")
          .select("*")
          .eq("restaurant_id", r.id)
          .eq("is_featured", true)
          .not("dish_photo_url", "is", null)
          .in("category", enabledCategories)
          .order("last_used_at", { ascending: true, nullsFirst: true })
          .order("times_used_in_posts", { ascending: true })
          .limit(1);

        const dish = dishes?.[0];
        if (!dish) { results.push({ restaurant: r.id, skipped: "no_eligible_dish" }); continue; }

        // Generate copy via AI
        const copyPrompt = `Você é um social media de restaurante. Crie uma legenda curta e envolvente para um post no Instagram.

RESTAURANTE: ${r.name}
CIDADE/ENDEREÇO: ${r.address || "—"}
PRATO: ${dish.name}${dish.price ? ` (R$ ${dish.price})` : ""}
DESCRIÇÃO: ${dish.description || "—"}
DIA DA SEMANA: ${dayName}

Regras:
- Português brasileiro, tom acolhedor e apetitoso.
- 2 a 4 frases, no máximo 280 caracteres.
- Termine com 3 a 5 hashtags relevantes.
- Não invente promoções nem preços.
- Nada de aspas duplas no início/fim.`;

        const copyResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: copyPrompt }],
          }),
        });
        if (!copyResp.ok) {
          console.error("copy gen failed", r.id, copyResp.status);
          results.push({ restaurant: r.id, error: "copy_failed" });
          continue;
        }
        const copyJson = await copyResp.json();
        const copyText: string = copyJson.choices?.[0]?.message?.content || `${dish.name} — venha provar no ${r.name}!`;

        // Generate image (Gemini Image, using dish photo as reference)
        const imgPrompt = `Create a professional Instagram square (1:1) post image for a restaurant.

RESTAURANT: "${r.name}"
DISH: "${dish.name}"
DAY: ${dayName}

DESIGN:
- Use the attached dish photo as the HERO of the composition. Keep the food faithful to the reference; enhance lighting/contrast like a magazine cover.
- Bold headline overlay with the dish name "${dish.name}" — Brazilian Portuguese, max 4 words, perfectly spelled.
- Subtle restaurant name "${r.name}" at the bottom.
- Warm appetizing palette, premium feel, no quotation marks, no decorative quotes.
- Do NOT cover the dish with text. Place text around or above/below.
- Brazilian Portuguese only — never mix with Spanish. Common avoid: "con" (use "com"), "una" (use "uma"), "vena" (use "venha").
- Less text correctly spelled is better than more text with errors.`;

        const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: imgPrompt },
                { type: "image_url", image_url: { url: dish.dish_photo_url } },
              ],
            }],
            modalities: ["image", "text"],
          }),
        });
        if (!imgResp.ok) {
          console.error("img gen failed", r.id, imgResp.status);
          results.push({ restaurant: r.id, error: "image_failed" });
          continue;
        }
        const imgJson = await imgResp.json();
        const base64 = imgJson.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!base64) { results.push({ restaurant: r.id, error: "no_image" }); continue; }

        // Upload to storage
        const b64data = base64.replace(/^data:image\/\w+;base64,/, "");
        const bytes = Uint8Array.from(atob(b64data), (c) => c.charCodeAt(0));
        const fileName = `${r.id}/${crypto.randomUUID()}.png`;
        const { error: upErr } = await admin.storage.from("promotion-images").upload(fileName, bytes, { contentType: "image/png" });
        if (upErr) { results.push({ restaurant: r.id, error: "upload_failed", detail: upErr.message }); continue; }
        const { data: pub } = admin.storage.from("promotion-images").getPublicUrl(fileName);
        const imageUrl = pub.publicUrl;

        // Create suggestion + version v1
        const { data: sug, error: sugErr } = await admin
          .from("social_post_suggestions")
          .insert({
            restaurant_id: r.id,
            dish_id: dish.id,
            suggested_for_date: todayDate,
            status: "pending",
            context_data: { dia_semana: dayName, dish_name: dish.name },
            copy_text: copyText,
          })
          .select("id")
          .single();
        if (sugErr) { results.push({ restaurant: r.id, error: "suggestion_insert", detail: sugErr.message }); continue; }

        const { data: ver, error: verErr } = await admin
          .from("social_post_versions")
          .insert({
            suggestion_id: sug.id,
            version_number: 1,
            image_url: imageUrl,
            prompt_used: imgPrompt,
          })
          .select("id")
          .single();
        if (verErr) { results.push({ restaurant: r.id, error: "version_insert", detail: verErr.message }); continue; }

        await admin.from("social_post_suggestions").update({ current_version_id: ver.id }).eq("id", sug.id);

        // Update dish rotation counters
        await admin.from("restaurant_dishes").update({
          last_used_at: new Date().toISOString(),
          times_used_in_posts: (dish.times_used_in_posts || 0) + 1,
        }).eq("id", dish.id);

        results.push({ restaurant: r.id, suggestion_id: sug.id, dish: dish.name });
      } catch (e) {
        console.error("restaurant loop error", r.id, e);
        results.push({ restaurant: r.id, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("social-suggest-daily error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
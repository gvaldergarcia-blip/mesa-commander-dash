import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Estratégia de branding: cada semana usa um tema/headline diferente.
// Rotaciona por número da semana ISO para garantir variação semanal previsível.
const WEEK_THEMES: Array<{
  theme: string;
  headlineTemplate: (dishName: string) => string;
  copyTone: string;
}> = [
  { theme: "Destaque da Semana", headlineTemplate: (d) => `Destaque da semana: ${d}`, copyTone: "Posicione como o prato em alta da semana — vibe acolhedora e convidativa." },
  { theme: "Clássico da Casa", headlineTemplate: (d) => `Clássico da casa`, copyTone: "Tom nostálgico e tradicional, reforce a herança e a receita testada pelo tempo." },
  { theme: "Pedido do Chef", headlineTemplate: (d) => `Pedido do chef`, copyTone: "Tom autoral e premium, sugestão pessoal do chef, com confiança e elegância." },
  { theme: "Sabor que Marca", headlineTemplate: (d) => `Sabor que marca`, copyTone: "Tom emocional e sensorial, foco em memória afetiva e experiência única." },
  { theme: "Feito pra Você", headlineTemplate: (d) => `Feito pra você`, copyTone: "Tom próximo e caloroso, hospitalidade brasileira, convite irresistível." },
  { theme: "Imperdível da Semana", headlineTemplate: (d) => `Imperdível`, copyTone: "Tom de urgência leve, oportunidade da semana, escassez sutil." },
];

function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function startOfISOWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

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
    const forceNew = !!body?.force; // ignora dedupe semanal

    // Find eligible restaurants (autopilot ON). Manual test should target the restaurant
    // even if its lifecycle status is "approved" instead of "active".
    let q = admin.from("restaurants")
      .select("id, name, address, image_url, social_autopilot_enabled, social_autopilot_categories, cuisine, status")
      .eq("social_autopilot_enabled", true);
    if (onlyRestaurantId) q = q.eq("id", onlyRestaurantId);
    else q = q.in("status", ["active", "approved"]);
    const { data: restaurants, error: rErr } = await q;
    if (rErr) throw rErr;

    if (onlyRestaurantId && (!restaurants || restaurants.length === 0)) {
      return new Response(JSON.stringify({
        processed: 0,
        results: [{ restaurant: onlyRestaurantId, error: "restaurant_not_eligible", detail: "Auto-pilot desativado ou restaurante não encontrado para geração de teste." }],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const today = new Date();
    const dayName = DAYS_PT[today.getDay()];
    const weekNumber = getISOWeek(today);
    const weekStart = startOfISOWeek(today);
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    for (const r of restaurants || []) {
      try {
        const todayDate = new Date(today.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).toISOString().slice(0, 10);

        // Cadência SEMANAL: pula se já existe sugestão pending/approved nesta semana ISO
        if (!forceNew) {
          const { data: existing } = await admin
            .from("social_post_suggestions")
            .select("id")
            .eq("restaurant_id", r.id)
            .gte("suggested_for_date", weekStartIso)
            .in("status", ["pending", "approved"])
            .limit(1);
          if (existing && existing.length > 0) {
            results.push({ restaurant: r.id, skipped: "already_has_this_week" });
            continue;
          }
        }

        const enabledCategories = (r.social_autopilot_categories?.length ? r.social_autopilot_categories : ["prato_principal"]) as string[];

        // Pick a dish. Weekly automation stays strict (featured + photo), but a manual
        // test run can fall back to any dish with photo so the user can validate image generation.
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

        let dish = dishes?.[0];

        if (!dish && onlyRestaurantId) {
          const { data: fallbackDishes } = await admin
            .from("restaurant_dishes")
            .select("*")
            .eq("restaurant_id", r.id)
            .not("dish_photo_url", "is", null)
            .in("category", enabledCategories)
            .order("last_used_at", { ascending: true, nullsFirst: true })
            .order("times_used_in_posts", { ascending: true })
            .limit(1);

          dish = fallbackDishes?.[0];
        }

        if (!dish) { results.push({ restaurant: r.id, skipped: "no_eligible_dish" }); continue; }

        // Rotate theme per-restaurant: pick the LEAST-recently-used theme for this restaurant
        // (avoids the "always Clássico da casa" problem). Uses count of past suggestions
        // combined with a hash of the restaurant id for a stable but varied offset.
        const { count: pastCount } = await admin
          .from("social_post_suggestions")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", r.id);
        const hash = Array.from(r.id as string).reduce((a, c) => a + c.charCodeAt(0), 0);
        const themeIndex = ((pastCount || 0) + hash + weekNumber) % WEEK_THEMES.length;
        const theme = WEEK_THEMES[themeIndex];

        // Generate copy via AI — alinhada ao tema branding da semana
        const copyPrompt = `Você é um social media estrategista de branding para restaurantes. Crie uma legenda envolvente para Instagram alinhada ao posicionamento da marca.

RESTAURANTE: ${r.name}
CIDADE/ENDEREÇO: ${r.address || "—"}
PRATO: ${dish.name}${dish.price ? ` (R$ ${dish.price})` : ""}
DESCRIÇÃO: ${dish.description || "—"}
DIA DA SEMANA: ${dayName}
TEMA DE BRANDING DA SEMANA: ${theme.theme}
TOM: ${theme.copyTone}

Regras:
- Português brasileiro, tom acolhedor e apetitoso.
- 2 a 4 frases, no máximo 280 caracteres.
- Reflita o TEMA e TOM acima — esta é uma campanha semanal de branding, não promoção.
- Foque em identidade, experiência e valor da marca; não invente preços, descontos ou promoções.
- Termine com 3 a 5 hashtags relevantes.
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

        // Headline branding rotativa por semana (texto que aparece NA imagem)
        const headlineText = theme.headlineTemplate(dish.name);

        // Generate image (Gemini Image, using dish photo as reference)
        const imgPrompt = `Award-winning editorial food photography for a high-end Instagram branding post (1:1 square, ultra-premium magazine quality). This is a weekly BRANDING campaign — not a promotion, no prices, no discounts, no badges.

RESTAURANT: "${r.name}"
DISH: "${dish.name}"
DAY: ${dayName}
WEEKLY THEME: "${theme.theme}"
HEADLINE OVERLAY (must appear on the image, perfectly spelled, Brazilian Portuguese): "${headlineText}"

ART DIRECTION (think Bon Appétit, Kinfolk, Eater, Michelin Guide):
- Hero: the attached dish photo, re-lit and re-composed as a cinematic still life. Keep the food 100% faithful to the reference (same dish, same ingredients, same plating) but elevate it: soft natural directional light (window light at golden hour), gentle shadows, subtle steam/moisture if appropriate, glossy textures, rich micro-detail.
- Composition: shallow depth of field, intentional negative space for typography, off-center hero, professional styling props (linen napkin, dark wood or stone surface, vintage cutlery, herbs, ingredient garnishes scattered tastefully).
- Color grading: warm, rich, slightly desaturated tones with deep contrast — moody editorial palette (cream, espresso, terracotta, deep green). Avoid neon, cartoonish or oversaturated colors.
- Camera feel: 50mm prime, f/2.0, soft bokeh, true-to-life food rendering, no plastic/CGI look, no "AI gloss".

TYPOGRAPHY (CRITICAL — must look like a designer made it, not AI):
- Headline EXACT TEXT: "${headlineText}". Brazilian Portuguese, max 5 words, perfectly kerned, elegant high-end serif (think Playfair Display, Canela or Tiempos) OR a refined modern sans (think Söhne, Inter Tight) — pick ONE family and stay consistent.
- Clear hierarchy: large headline + thin small-caps secondary line for "${dish.name}" if it fits; tiny restaurant signature "${r.name}" at the very bottom.
- Generous letter-spacing on small text. NO quotation marks, NO decorative ornaments, NO emoji, NO drop shadows, NO outlined text, NO gradients on text.
- Text lives in clean negative space — never overlapping the food. White or warm cream text on darker areas; deep charcoal on light areas. High contrast, fully legible.

HARD RULES:
- Brazilian Portuguese only — never Spanish. Avoid: "con"→"com", "una"→"uma", "vena"→"venha".
- Spell every letter exactly as written above. If unsure, use FEWER words.
- No watermarks, no stock-photo logos, no UI mockups, no Instagram chrome.
- No price tags, no % off, no badges, no stickers, no arrows.
- Output must feel like a $10k commissioned campaign shot — restrained, confident, premium.`;

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
            context_data: { dia_semana: dayName, dish_name: dish.name, week_number: weekNumber, week_theme: theme.theme, headline: headlineText },
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
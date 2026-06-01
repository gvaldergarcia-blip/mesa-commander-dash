import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();

    // Input validation
    const str = (v: any, max = 200) => typeof v === 'string' ? v.slice(0, max) : '';
    const restaurantName = str(body.restaurantName, 100);
    const cuisineType = str(body.cuisineType, 50);
    const dishName = str(body.dishName, 100);
    const restaurantPhrase = str(body.restaurantPhrase, 200);
    const targetAudience = str(body.targetAudience, 100);
    const brandTone = str(body.brandTone, 50);
    const campaignDay = str(body.campaignDay, 50);
    const objective = str(body.objective, 200);
    const restaurantId = str(body.restaurantId, 36);
    const userId = str(body.userId, 36);
    const customHeadline = str(body.customHeadline, 200);
    const customSubheadline = str(body.customSubheadline, 200);
    const customCta = str(body.customCta, 100);
    const address = str(body.address, 200);
    const logoUrl = str(body.logoUrl, 500);
    const referenceImage = body.referenceImage && typeof body.referenceImage === 'string' ? body.referenceImage : null;
    const ambientPhotoUrl = body.ambientPhotoUrl && typeof body.ambientPhotoUrl === 'string' ? body.ambientPhotoUrl : null;
    const realAmbient = !!body.realAmbient && !!ambientPhotoUrl;
    const originalPrice = body.originalPrice;
    const promoPrice = body.promoPrice;
    const discount = body.discount;
    const hasDiscount = body.hasDiscount ?? true;
    const includeLogo = body.includeLogo ?? false;
    const includeAddress = body.includeAddress ?? false;

    if (!dishName) {
      return new Response(JSON.stringify({ error: "Nome do prato é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!restaurantName) {
      return new Response(JSON.stringify({ error: "Nome do restaurante é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build prompt based on whether discount exists
    let promptText: string;

    const headlineText = customHeadline || dishName;
    const subtitleText = customSubheadline || '';
    const ctaText = customCta || '';

    // === ART DIRECTION PREMIUM ===
    // Filosofia: pensar como direção de arte de revista gastronômica (Kinfolk,
    // Cereal, Bon Appétit, Le Cordon Bleu). Menos regras, mais visão.
    // Tipografia editorial, composição cinematográfica, fotografia 4K.

    const sharedArtDirection = `
You are an award-winning art director for a luxury gastronomy magazine (think Kinfolk, Cereal, Bon Appétit). Create ONE Instagram post (1:1, 1080×1080) for the restaurant below. The result must look like a premium editorial cover, NOT a generic stock-photo template.

RESTAURANT: ${restaurantName}${cuisineType ? ` · ${cuisineType}` : ''}
HERO DISH: ${dishName}
${restaurantPhrase ? `BRAND VOICE: ${restaurantPhrase}` : ''}
${campaignDay ? `OCCASION: ${campaignDay}` : ''}
${targetAudience ? `AUDIENCE: ${targetAudience}` : ''}
${brandTone ? `MOOD: ${brandTone}` : ''}
${objective ? `INTENT: ${objective}` : ''}

PHOTOGRAPHY (THE FOUNDATION):
- Hero shot of the dish, food-magazine quality, 4K, hyper-realistic
- Cinematic natural lighting (golden hour or moody window light), shallow depth of field, soft bokeh
- Tactile textures: visible steam, glistening sauce, fresh herbs, condensation on glassware
- Composition: rule of thirds, generous negative space reserved for typography
- Color grading: rich, warm, editorial — never saturated, never plastic
- The photo should feel like it was shot by a real food photographer, not generated

REALISM & SCALE (MANDATORY — this is the difference between premium and amateur):
- The dish MUST be portrayed at its TRUE real-world size and proportion. A tartar, an appetizer, a dessert, a small plate — render it small and refined on the plate, NEVER inflated to fill the frame.
- Plate, cutlery, glassware, hands and table surface must all be in correct, believable scale relative to each other (a fork is ~20cm, a dinner plate ~27cm, a tartar portion ~8-10cm wide). No giant food, no oversized portions, no cartoon proportions.
- Reference real restaurant plating: minimalist, centered, with visible plate rim and breathing room around the dish — like a real chef's pass photo, not a fast-food advert.
- Camera perspective should feel natural: 35-50mm equivalent, slight overhead or 3/4 angle as a human would see it sitting at the table. No fisheye, no extreme close-up that distorts scale.
- Surfaces, shadows, reflections and depth of field must all behave like real physics — if any element looks "AI-inflated" or unrealistically large, REDO the composition.

TYPOGRAPHY (THE DIFFERENTIATOR):
- Use a refined typographic system: ONE elegant serif (Playfair Display, Cormorant, Canela) for the headline, ONE clean sans (Inter, Neue Haas, Helvetica Neue) for support text
- Headline: large, confident, with generous tracking and clear hierarchy
- All text sits in negative space — NEVER overlapping the dish, NEVER scattered, NEVER bubble-style
- Treat type as design, not decoration. No drop shadows unless purposeful. No emojis embedded in titles.
- Maximum 3 text blocks total: HEADLINE / supporting line / restaurant signature

LAYOUT (THE ARCHITECTURE):
- One clear focal point (the dish) + one clear typographic moment
- Asymmetric, intentional, breathing — feel of a magazine cover, not a flyer
- Restaurant name appears once, small and refined, as a signature (bottom or top corner)

TEXT CONTENT (Brazilian Portuguese — render EXACTLY, no Spanish):
• HEADLINE: "${headlineText}"
${subtitleText ? `• SUPPORT LINE: "${subtitleText}"` : ''}
${ctaText ? `• CALL TO ACTION: "${ctaText}"` : ''}
• SIGNATURE: "${restaurantName}"

SPELLING (NON-NEGOTIABLE):
- Every word must match the source above letter-by-letter
- If unsure about a word, REMOVE it rather than misspell. Less is more.
- No invented words, no Spanish substitutions (com NOT con, uma NOT una, já NOT jâ)
- Prefer 2–4 words per text block. Editorial restraint over noise.

FORBIDDEN (instant rejection):
- Generic stock-photo aesthetic, AI-template look, clip-art, cartoonish style
- Text floating over the dish itself
- Quotation marks around any text
- Random letters, garbled words, fake foreign characters
- Heavy filters, oversaturated colors, plastic skin/food
- Watermarks, logos other than what's explicitly provided
- Decorative emoji clusters, hashtags, web URLs
`;

    if (hasDiscount && originalPrice && promoPrice) {
      promptText = `${sharedArtDirection}

PRICE TREATMENT (this is a promotional post):
- Show "R$${originalPrice}" with a clean strikethrough line
- Display "R$${promoPrice}" as the dominant price in elegant typography
- Add ONE refined discount mark: "${discount}% OFF" — minimal, geometric, NOT a cartoon bursting badge
- Keep the price block contained, integrated into the layout's negative space, not slapped on top`;
    } else {
      promptText = `${sharedArtDirection}

NO PRICES, NO DISCOUNT BADGES — this is a brand/awareness post, treat it like an editorial feature, not a sale flyer.`;
    }
    if (includeLogo && logoUrl) {
      promptText += `\n\nLOGO: The restaurant's actual logo is attached. Place it EXACTLY as provided (do not recreate), small and refined, in a top corner. Treat it as a premium brand mark, with proper margin and breathing room.`;
    }

    if (includeAddress && address) {
      promptText += `\n\nADDRESS: Place "${address}" as a tiny, refined sans-serif line at the very bottom edge — editorial caption style, not promotional.`;
    }

    if (referenceImage) {
      promptText += `\n\nDISH REFERENCE (HIGHEST PRIORITY — TREAT AS GROUND TRUTH):
- An attached image shows the ACTUAL dish that must appear in the final art.
- You MUST use this exact dish — same ingredients, same plating, same proportions, same colors, same garnish — as the hero of the composition. Do NOT invent a different dish or substitute it with a generic stock burger/plate/pasta.
- Re-light, re-frame, and re-compose the dish so it integrates naturally into the editorial scene (background, table, props, headline area). Adjust angle, crop, depth of field and shadows so the dish looks like it was PHOTOGRAPHED on location for THIS layout — never pasted on top.
- HYPER-REALISM (mandatory): meat must look like real grilled meat with sear marks and natural juices, bread/buns must have real crust texture and crumb, cheese must melt with believable viscosity, vegetables must show fresh micro-textures, sauces must reflect light like real liquids. ZERO plastic sheen, ZERO CGI/3D look, ZERO over-saturated cartoon colors. It must be indistinguishable from a 35mm DSLR food-photography shot.
- Keep the dish at TRUE real-world scale relative to plate, cutlery, hands and table — never inflate the food to fill the frame.
- If the reference photo has a distracting or low-quality background, REPLACE only the background to match the editorial scene, but PRESERVE the dish itself untouched in identity and detail.`;
    }

    if (realAmbient) {
      // Force visual variety across multiple generations using the same ambient photo
      const angles = [
        "low 3/4 angle from the diner's seated perspective, ~30° from the table surface",
        "high overhead 75°–85° flat-lay capturing the table edge and a slice of the venue behind",
        "side-on eye-level shot at table height, dish in sharp foreground, deep ambient bokeh",
        "over-the-shoulder angle as if a guest is reaching toward the plate, ambient visible in the upper third",
        "wide 35mm establishing shot with the dish offset to the left third and the restaurant interior filling the right two-thirds",
        "intimate macro-leaning 50mm shot, dish slightly off-center, window light from camera-left, ambient softly defocused",
      ];
      const positions = [
        "dish on the lower-left third of the frame",
        "dish on the lower-right third",
        "dish centered with cutlery entering from the right edge",
        "dish on the upper-left third with a wine glass companion",
        "dish framed between two out-of-focus foreground elements (glass, bread basket)",
      ];
      const lightMoods = [
        "warm golden-hour window light from camera-left",
        "cool overcast daylight, soft and even",
        "moody tungsten evening light with warm highlights and deep shadows",
        "bright midday diffused light bouncing off pale surfaces",
      ];
      const seed = Math.floor(Math.random() * 1_000_000);
      const angle = angles[seed % angles.length];
      const position = positions[(seed >> 3) % positions.length];
      const mood = lightMoods[(seed >> 5) % lightMoods.length];

      promptText += `\n\nREAL AMBIENT (HIGHEST PRIORITY): An attached image shows the REAL interior of ${restaurantName}. Place the dish naturally on a table inside that exact venue. Preserve EVERY architectural detail — walls, furniture, decor, lighting fixtures, ceiling, flooring — UNCHANGED, as if a photographer stood inside and shot the dish on location.

VARIATION DIRECTIVE (variation seed #${seed} — MUST differ from any prior generation in this venue):
- Camera angle for THIS shot: ${angle}.
- Dish position in frame: ${position}.
- Lighting mood: ${mood}.
- Pick a DIFFERENT table, corner, or vantage point of the venue than an obvious centered hero. Show a new slice of the restaurant each time.
- Vary plate, cutlery, glassware and props naturally — never reuse the exact same flat-lay twice.
- Background must remain recognisable as the same restaurant but viewed from a fresh perspective.

PHOTOREALISM (MANDATORY — this is a real-on-location editorial shot, not a render):
- Output must be INDISTINGUISHABLE from a 35mm full-frame DSLR photograph (Canon R5 / Sony A7R / Hasselblad look).
- Real physics of light: accurate shadows, soft falloff, believable reflections on cutlery and glass, micro-contrast on the food.
- Real skin/material textures: tablecloth fibres, ceramic glaze imperfections, food surface moisture and steam.
- ABSOLUTELY NO 3D-render look, no CGI plastic sheen, no AI-smoothing, no over-saturated colors, no fake bokeh discs.
- The ambient interior must look photographed (same grain, same white balance, same depth cues) — not pasted onto the dish.
- If anything looks "AI-generated" — redo lighting, perspective, and texture until it could pass as a phone-uploaded restaurant photo.`;
    }

    promptText += `\n\nFinal check: would this image fit on the cover of a premium gastronomy magazine? If not, refine the lighting, typography, and composition until it does.`;

    console.log("Generating promo image for:", dishName, "at", restaurantName, "hasDiscount:", hasDiscount, "withRef:", !!referenceImage, "withLogo:", !!(includeLogo && logoUrl), "realAmbient:", realAmbient);

    // Build multimodal content with images
    const contentParts: any[] = [{ type: "text", text: promptText }];
    
    // Add logo image if enabled
    if (includeLogo && logoUrl) {
      contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
    }
    
    // Add reference image if provided
    if (referenceImage) {
      contentParts.push({ type: "image_url", image_url: { url: referenceImage } });
    }

    // Add ambient photo (real interior) if enabled
    if (realAmbient && ambientPhotoUrl) {
      contentParts.push({ type: "image_url", image_url: { url: ambientPhotoUrl } });
    }
    
    const userContent: any = contentParts.length === 1 ? promptText : contentParts;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content: userContent }],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response structure:", JSON.stringify({
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
      hasImages: !!data.choices?.[0]?.message?.images,
      imagesLength: data.choices?.[0]?.message?.images?.length,
    }));

    // Extract image from response
    let base64ImageUrl =
      data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;

    if (!base64ImageUrl) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.startsWith('data:image/')) {
        base64ImageUrl = content;
      }
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part?.type === 'image_url' && part?.image_url?.url) {
            base64ImageUrl = part.image_url.url;
            break;
          }
        }
      }
    }

    if (!base64ImageUrl) {
      console.error("Full AI response (no image found):", JSON.stringify(data).substring(0, 2000));
      throw new Error("No image was generated by the AI model. Try again or use a smaller/different reference image.");
    }

    // Save image to storage and promotions_assets
    let savedImageUrl = base64ImageUrl;
    let assetId: string | null = null;

    if (restaurantId) {
      try {
        const base64Data = base64ImageUrl.replace(/^data:image\/\w+;base64,/, "");
        const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const fileName = `${restaurantId}/${crypto.randomUUID()}.png`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("promotion-images")
          .upload(fileName, imageBytes, {
            contentType: "image/png",
            upsert: false,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
        } else {
          const { data: publicUrlData } = supabaseAdmin.storage
            .from("promotion-images")
            .getPublicUrl(fileName);

          savedImageUrl = publicUrlData.publicUrl;

          // Save to promotions_assets
          const { data: assetData, error: assetError } = await supabaseAdmin
            .from("promotions_assets")
            .insert({
              restaurant_id: restaurantId,
              campaign_type: hasDiscount ? "com_desconto" : "sem_desconto",
              dish_name: dishName,
              original_price: hasDiscount ? parseFloat(originalPrice) || null : null,
              promo_price: hasDiscount ? parseFloat(promoPrice) || null : null,
              discount_percent: hasDiscount ? parseInt(discount) || null : null,
              campaign_goal: objective || null,
              campaign_day: campaignDay || null,
              target_audience: targetAudience || null,
              brand_tone: brandTone || null,
              include_logo: includeLogo,
              include_address: includeAddress,
              image_url: savedImageUrl,
              reference_image_used: !!referenceImage,
              status: "success",
            })
            .select("id")
            .single();

          if (assetError) {
            console.error("promotions_assets insert error:", assetError);
          } else {
            assetId = assetData?.id || null;
          }

          // Also save to marketing_posts for backward compat
          await supabaseAdmin
            .from("marketing_posts")
            .insert({
              restaurant_id: restaurantId,
              user_id: userId || null,
              headline: dishName,
              subtext: hasDiscount
                ? `De R$${originalPrice} por R$${promoPrice} (${discount}% OFF) — ${objective}`
                : `${objective} — ${campaignDay}`,
              cta: `${campaignDay} | ${targetAudience} | ${brandTone}`,
              format: "instagram_post",
              type: "promo_ia",
              image_url: savedImageUrl,
            });
        }
      } catch (saveErr) {
        console.error("Error saving image:", saveErr);
      }
    }

    return new Response(
      JSON.stringify({ imageUrl: savedImageUrl, assetId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("generate-promo-image error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

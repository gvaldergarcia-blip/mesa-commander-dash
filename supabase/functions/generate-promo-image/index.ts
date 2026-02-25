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

    const {
      restaurantName,
      cuisineType,
      dishName,
      restaurantPhrase,
      originalPrice,
      promoPrice,
      discount,
      targetAudience,
      brandTone,
      campaignDay,
      objective,
      referenceImage,
      restaurantId,
      userId,
      hasDiscount = true,
      includeLogo = false,
      includeAddress = false,
      logoUrl,
      address,
    } = await req.json();

    // Build prompt based on whether discount exists
    let promptText: string;

    if (hasDiscount && originalPrice && promoPrice) {
      promptText = `Create a professional Instagram promotional post image for a restaurant.

RESTAURANT: "${restaurantName}" — ${cuisineType} cuisine.
DISH: "${dishName}"
${restaurantPhrase ? `RESTAURANT PHRASE: "${restaurantPhrase}" — This phrase MUST appear prominently in the image with elegant, premium typography. It should be a central visual element, styled beautifully (e.g., script or serif font, with decorative elements like quotation marks or subtle ornaments).` : ''}
PROMOTION: From R$${originalPrice} to R$${promoPrice} (${discount}% OFF)
DAY: ${campaignDay}
TARGET: ${targetAudience}
TONE: ${brandTone}
OBJECTIVE: ${objective}

DESIGN REQUIREMENTS:
- Professional food photography style with the dish as hero element
- Bold headline text overlaid: "${dishName}"
${restaurantPhrase ? `- The phrase "${restaurantPhrase}" displayed with premium, elegant typography — make it visually striking and memorable` : ''}
- Prominent price display: crossed out "R$${originalPrice}" and highlighted "R$${promoPrice}"
- A circular discount badge showing "${discount}% OFF"
- Restaurant name "${restaurantName}" at bottom
- Warm, appetizing color palette with rich contrast
- Instagram square format (1:1 aspect ratio)
- Premium, magazine-quality look
- No blurry text — all text must be sharp and readable
- Dark or blurred background to make the dish pop`;
    } else {
      promptText = `Create a professional Instagram post image for a restaurant.

RESTAURANT: "${restaurantName}" — ${cuisineType} cuisine.
DISH/ITEM: "${dishName}"
${restaurantPhrase ? `RESTAURANT PHRASE: "${restaurantPhrase}" — This phrase MUST appear prominently in the image with elegant, premium typography. It should be THE central visual element, styled beautifully (e.g., script or serif font, with decorative elements like quotation marks or subtle ornaments). Make it the hero text of the design.` : ''}
DAY: ${campaignDay}
TARGET: ${targetAudience}
TONE: ${brandTone}
OBJECTIVE: ${objective}

DESIGN REQUIREMENTS:
- Professional food photography style with the dish as hero element
- Bold headline text overlaid: "${dishName}"
${restaurantPhrase ? `- The phrase "${restaurantPhrase}" displayed with premium, elegant typography — make it the most visually striking text element` : ''}
- NO prices or discount badges — this is NOT a promotional post with discount
- Restaurant name "${restaurantName}" at bottom
- Warm, appetizing color palette with rich contrast
- Instagram square format (1:1 aspect ratio)
- Premium, magazine-quality look
- No blurry text — all text must be sharp and readable
- Dark or blurred background to make the dish pop
- Focus on the dish name, headline, and a compelling CTA`;
    }

    if (includeLogo && logoUrl) {
      promptText += `\n- Include the restaurant logo in the top-left corner of the image (small and elegant).`;
    }

    if (includeAddress && address) {
      promptText += `\n- Include the address "${address}" in a small, discrete font at the very bottom of the image.`;
    }

    if (referenceImage) {
      promptText += `\n\nIMPORTANT: Use the attached reference image as the base/inspiration for the dish photo. Keep the food from the reference photo but enhance it with professional lighting, add the text overlay, and restaurant branding on top of it.`;
    }

    promptText += `\n\nDO NOT include any watermarks or logos other than the restaurant name.`;

    console.log("Generating promo image for:", dishName, "at", restaurantName, "hasDiscount:", hasDiscount, "withRef:", !!referenceImage);

    const userContent: any = referenceImage
      ? [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: referenceImage } },
        ]
      : promptText;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
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

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
    } = await req.json();

    const promptText = `Create a professional Instagram promotional post image for a restaurant.

RESTAURANT: "${restaurantName}" — ${cuisineType} cuisine.
DISH: "${dishName}"
PROMOTION: From R$${originalPrice} to R$${promoPrice} (${discount}% OFF)
DAY: ${campaignDay}
TARGET: ${targetAudience}
TONE: ${brandTone}
OBJECTIVE: ${objective}

DESIGN REQUIREMENTS:
- Professional food photography style with the dish as hero element
- Bold headline text overlaid: "${dishName}"
- Prominent price display: crossed out "R$${originalPrice}" and highlighted "R$${promoPrice}"
- A circular discount badge showing "${discount}% OFF"
- Restaurant name "${restaurantName}" at bottom
- Warm, appetizing color palette with rich contrast
- Instagram square format (1:1 aspect ratio)
- Premium, magazine-quality look
- No blurry text — all text must be sharp and readable
- Dark or blurred background to make the dish pop
${referenceImage ? "\nIMPORTANT: Use the attached reference image as the base/inspiration for the dish photo. Keep the food from the reference photo but enhance it with professional lighting, add the promotional text overlay, discount badge, and restaurant branding on top of it." : ""}

DO NOT include any watermarks or logos other than the restaurant name.`;

    console.log("Generating promo image for:", dishName, "at", restaurantName, "with reference:", !!referenceImage);

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
      contentPreview: typeof data.choices?.[0]?.message?.content === 'string' 
        ? data.choices[0].message.content.substring(0, 200) 
        : typeof data.choices?.[0]?.message?.content,
    }));

    // Try multiple extraction paths
    let base64ImageUrl =
      data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
    
    // Fallback: check if content itself contains base64 image
    if (!base64ImageUrl) {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.startsWith('data:image/')) {
        base64ImageUrl = content;
      }
      // Check if content is array with image parts
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part?.type === 'image_url' && part?.image_url?.url) {
            base64ImageUrl = part.image_url.url;
            break;
          }
        }
      }
    }

    const textResponse = data.choices?.[0]?.message?.content || "";

    if (!base64ImageUrl) {
      console.error("Full AI response (no image found):", JSON.stringify(data).substring(0, 2000));
      throw new Error("No image was generated by the AI model. Try again or use a smaller/different reference image.");
    }

    // Save image to storage and marketing_posts if restaurantId is provided
    let savedImageUrl = base64ImageUrl;
    let postId: string | null = null;

    if (restaurantId) {
      try {
        // Extract base64 data
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

          // Save to marketing_posts
          const { data: postData, error: postError } = await supabaseAdmin
            .from("marketing_posts")
            .insert({
              restaurant_id: restaurantId,
              user_id: userId || null,
              headline: dishName,
              subtext: `De R$${originalPrice} por R$${promoPrice} (${discount}% OFF) — ${objective}`,
              cta: `${campaignDay} | ${targetAudience} | ${brandTone}`,
              format: "instagram_post",
              type: "promo_ia",
              image_url: savedImageUrl,
            })
            .select("id")
            .single();

          if (postError) {
            console.error("marketing_posts insert error:", postError);
          } else {
            postId = postData?.id || null;
          }
        }
      } catch (saveErr) {
        console.error("Error saving image:", saveErr);
        // Continue — return base64 even if save fails
      }
    }

    return new Response(
      JSON.stringify({ imageUrl: savedImageUrl, textResponse, postId }),
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

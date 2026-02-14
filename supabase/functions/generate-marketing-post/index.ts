import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = "https://akqldesakmcroydbgkbe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrcWxkZXNha21jcm95ZGJna2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNzU5MzMsImV4cCI6MjA3MDk1MTkzM30.z9-eadw-xSeHgnqUUO5BMm2vVkabfY3p41Yb9CGPXIM";

interface PostRequest {
  restaurant_id: string;
  restaurant_name: string;
  type: string;
  format: "square" | "story";
  headline: string;
  subtext?: string;
  cta?: string;
  template_id?: string;
  cuisine?: string;
}

const TYPE_LABELS: Record<string, string> = {
  fila: "Fila Aberta",
  reserva: "Reserva Disponível",
  promo: "Promoção Especial",
  destaque: "Destaque do Dia",
  evento: "Evento Especial",
};

const TEMPLATE_STYLES: Record<string, { bg: string; accent: string; mood: string }> = {
  gradient_warm: { bg: "warm orange gradient background", accent: "golden", mood: "inviting and warm" },
  gradient_dark: { bg: "dark elegant background with subtle warm lighting", accent: "amber gold", mood: "sophisticated and premium" },
  minimal_light: { bg: "clean white background with subtle warm textures", accent: "orange", mood: "clean and modern" },
  vibrant_food: { bg: "vibrant food-themed colorful background", accent: "red-orange", mood: "appetizing and energetic" },
  elegant_black: { bg: "matte black background with gold accents", accent: "gold", mood: "luxury fine dining" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PostRequest = await req.json();
    const {
      restaurant_id,
      restaurant_name,
      type,
      format,
      headline,
      subtext,
      cta,
      template_id = "gradient_warm",
      cuisine,
    } = body;

    if (!restaurant_id || !headline || !type || !format) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is member of restaurant
    const { data: membership } = await supabase
      .from("restaurant_members" as any)
      .select("restaurant_id")
      .eq("user_id", user.id)
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Sem permissão para este restaurante" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = TEMPLATE_STYLES[template_id] || TEMPLATE_STYLES.gradient_warm;
    const typeLabel = TYPE_LABELS[type] || type;
    const dimensions = format === "square" ? "1080x1080 (1:1 square)" : "1080x1920 (9:16 vertical story)";
    const aspectRatio = format === "square" ? "1:1" : "9:16";

    // Build the prompt for AI image generation
    const prompt = `Create a professional restaurant social media post image for Instagram.
Format: ${dimensions}, ${aspectRatio} aspect ratio.
Style: ${template.bg}, ${template.mood} atmosphere.
Restaurant: "${restaurant_name}"${cuisine ? ` (${cuisine} cuisine)` : ""}.
Post type: ${typeLabel}.
Main headline text displayed prominently: "${headline}"
${subtext ? `Secondary text below headline: "${subtext}"` : ""}
${cta ? `Call-to-action button/badge at bottom: "${cta}"` : ""}
Restaurant name "${restaurant_name}" as signature at bottom.
Color accent: ${template.accent}, with MesaClik orange (#F97316) as primary brand color.
The text must be readable, centered, and beautifully typeset.
Professional food/restaurant marketing design. Ultra high resolution.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate image via AI gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao gerar imagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl || !imageUrl.startsWith("data:image")) {
      console.error("No image in AI response:", JSON.stringify(aiData).substring(0, 500));
      return new Response(JSON.stringify({ error: "Imagem não gerada pela IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64 image
    const base64Data = imageUrl.split(",")[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage
    const timestamp = Date.now();
    const filePath = `${restaurant_id}/${timestamp}_${type}_${format}.png`;

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey || SUPABASE_ANON_KEY);

    const { error: uploadError } = await adminClient.storage
      .from("marketing_assets")
      .upload(filePath, bytes, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Erro ao salvar imagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = adminClient.storage
      .from("marketing_assets")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // Save record to marketing_posts
    const { data: post, error: insertError } = await supabase
      .from("marketing_posts" as any)
      .insert({
        restaurant_id,
        user_id: user.id,
        type,
        format,
        headline,
        subtext: subtext || null,
        cta: cta || null,
        template_id,
        image_url: publicUrl,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar post" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, post }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

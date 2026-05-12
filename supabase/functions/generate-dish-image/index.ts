import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { restaurantId, dishId, customerName, headline, useRealPhoto = true } = await req.json();
    if (!restaurantId || !dishId || !customerName || !headline) {
      return new Response(JSON.stringify({ error: "missing params" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: dish, error: dErr } = await admin
      .from("menu_dishes")
      .select("name, description, photo_url")
      .eq("id", dishId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (dErr || !dish) return new Response(JSON.stringify({ error: "dish not found" }), { status: 404, headers: corsHeaders });

    const prompt = useRealPhoto && dish.photo_url
      ? `Recrie esta fotografia profissional do prato "${dish.name}" em formato quadrado para campanha. Adicione no canto inferior um banner com o texto: "${headline}" e abaixo, em fonte menor: "${customerName}". Estilo: foto de gastronomia premium, fundo escuro, iluminação cinematográfica, texto legível em branco com leve sombra. Não distorça o prato.`
      : `Crie uma fotografia profissional de gastronomia premium do prato "${dish.name}". ${dish.description ?? ""} Formato quadrado, fundo escuro elegante, iluminação cinematográfica. Adicione no canto inferior um banner com o texto: "${headline}" e abaixo, em fonte menor: "${customerName}". Texto em branco com leve sombra, totalmente legível.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: useRealPhoto && dish.photo_url
              ? [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dish.photo_url } },
                ]
              : [{ type: "text", text: prompt }],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: `image gen failed: ${t}` }), { status: 500, headers: corsHeaders });
    }
    const aiData = await aiResp.json();
    const imgUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
    if (!imgUrl) return new Response(JSON.stringify({ error: "no image returned" }), { status: 500, headers: corsHeaders });

    // Salva no bucket
    const base64 = imgUrl.split(",")[1];
    const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${restaurantId}/campaigns/${Date.now()}-${crypto.randomUUID()}.png`;
    const up = await admin.storage.from("dish-photos").upload(path, bin, { contentType: "image/png", upsert: false });
    if (up.error) return new Response(JSON.stringify({ error: up.error.message }), { status: 500, headers: corsHeaders });

    const publicUrl = admin.storage.from("dish-photos").getPublicUrl(path).data.publicUrl;
    return new Response(JSON.stringify({ ok: true, image_url: publicUrl, dish_name: dish.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "erro" }), { status: 500, headers: corsHeaders });
  }
});
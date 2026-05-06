import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function resolveUrl(baseUrl: string, maybeRelative: string) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  return [...new Set(urls.filter((url): url is string => !!url))];
}

function extractAssetUrlsFromHtml(html: string, baseUrl: string) {
  const matches = [
    ...html.matchAll(/<(?:img|source)[^>]+(?:src|data-src)=["']([^"']+)["']/gi),
    ...html.matchAll(/<a[^>]+href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi),
    ...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi),
    ...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi),
  ];

  const assetUrls = matches
    .map((match) => resolveUrl(baseUrl, match[1]))
    .filter(Boolean) as string[];

  const imageUrls = assetUrls.filter((url) => {
    const lower = url.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => lower.includes(ext));
  });

  const pdfUrls = assetUrls.filter((url) => url.toLowerCase().includes(".pdf"));

  return {
    imageUrls: uniqueUrls(imageUrls).slice(0, 12),
    pdfUrls: uniqueUrls(pdfUrls).slice(0, 3),
  };
}

async function resolveMenuAssets(menuSource: string) {
  const normalized = menuSource.trim();
  if (!normalized) return { contentType: null, imageUrls: [], pdfUrls: [], sourceUrl: null };

  const directUrl = isAbsoluteUrl(normalized) ? normalized : null;
  if (!directUrl) return { contentType: null, imageUrls: [], pdfUrls: [], sourceUrl: null };

  const lowerUrl = directUrl.toLowerCase();
  if (IMAGE_EXTENSIONS.some((ext) => lowerUrl.includes(ext))) {
    return { contentType: "image/direct", imageUrls: [directUrl], pdfUrls: [], sourceUrl: directUrl };
  }
  if (lowerUrl.includes(".pdf")) {
    return { contentType: "application/pdf", imageUrls: [], pdfUrls: [directUrl], sourceUrl: directUrl };
  }

  const resp = await fetch(directUrl, { headers: { "User-Agent": "Mozilla/5.0 MesaClik Menu Extractor" } });
  const contentType = (resp.headers.get("content-type") || "").toLowerCase();

  if (contentType.startsWith("image/")) {
    return { contentType, imageUrls: [directUrl], pdfUrls: [], sourceUrl: directUrl };
  }
  if (contentType.includes("pdf")) {
    return { contentType, imageUrls: [], pdfUrls: [directUrl], sourceUrl: directUrl };
  }
  if (!contentType.includes("html")) {
    return { contentType, imageUrls: [], pdfUrls: [], sourceUrl: directUrl };
  }

  const html = await resp.text();
  const extracted = extractAssetUrlsFromHtml(html, directUrl);
  return {
    contentType,
    imageUrls: extracted.imageUrls,
    pdfUrls: extracted.pdfUrls,
    sourceUrl: directUrl,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const restaurantId = String(body.restaurantId || "").slice(0, 36);
    if (!restaurantId) return new Response(JSON.stringify({ error: "restaurantId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Validate ownership (public schema)
    const { data: rest, error: restErr } = await admin
      .from("restaurants")
      .select("id, owner_id, name, menu_url")
      .eq("id", restaurantId)
      .maybeSingle();
    if (restErr) console.error("public.restaurants query error:", restErr);
    if (!rest) return new Response(JSON.stringify({ error: "Restaurant not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (rest.owner_id !== user.id) {
      // also allow platform admin
      const { data: isAdm } = await admin.rpc("is_admin", { user_id: user.id });
      if (!isAdm) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // menu_image_url only lives in mesaclik schema
    let menuImageUrl: string | null = null;
    try {
      const { data: mRest } = await admin
        .schema("mesaclik" as any)
        .from("restaurants")
        .select("menu_url, menu_image_url")
        .eq("id", restaurantId)
        .maybeSingle();
      menuImageUrl = (mRest as any)?.menu_image_url || (mRest as any)?.menu_url || null;
    } catch (e) {
      console.error("mesaclik.restaurants query error:", e);
    }

    const menuSource = rest.menu_url || menuImageUrl;
    if (!menuSource) {
      return new Response(JSON.stringify({ error: "Cardápio não cadastrado. Configure em Settings → Cardápio." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resolvedMenu = await resolveMenuAssets(menuSource);
    const resolvedImages = resolvedMenu.imageUrls.slice(0, 10);

    if (resolvedImages.length === 0) {
      const detail = resolvedMenu.pdfUrls.length > 0
        ? "O link cadastrado aponta para um PDF. No momento, cadastre a imagem do cardápio ou uma página que contenha imagens do cardápio."
        : resolvedMenu.contentType?.includes("html")
          ? "O link cadastrado abre uma página web, mas não encontrei imagens do cardápio dentro dela."
          : "O link cadastrado não retorna uma imagem válida do cardápio.";

      return new Response(JSON.stringify({ error: detail }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ask Gemini Vision to extract dishes from the menu images
    const prompt = `Você é um assistente que extrai pratos de cardápios de restaurantes em português brasileiro.

Analise o cardápio anexado e devolva um JSON com TODOS os itens encontrados, organizados por categoria.

Categorias permitidas (use exatamente esses valores):
- "entrada"
- "prato_principal"
- "sobremesa"
- "bebida"
- "outro"

Para cada item, extraia:
- name (string, nome exato como está no cardápio)
- description (string, descrição se houver, senão null)
- price (number em reais, ex: 49.90, ou null se não tiver)
- category (uma das categorias acima)

IMPORTANTE:
- Não invente pratos. Só liste o que estiver explicitamente no cardápio.
- Mantenha a grafia exata em português brasileiro.
- Se um item não tem preço claro, deixe price como null.
- Bebidas alcoólicas e não-alcoólicas vão em "bebida".
- Pratos principais (carnes, massas, peixes, hambúrgueres, pizzas) vão em "prato_principal".`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...resolvedImages.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_dishes",
              description: "Salva pratos extraídos do cardápio",
              parameters: {
                type: "object",
                properties: {
                  dishes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: ["string", "null"] },
                        price: { type: ["number", "null"] },
                        category: { type: "string", enum: ["entrada", "prato_principal", "sobremesa", "bebida", "outro"] },
                      },
                      required: ["name", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["dishes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_dishes" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao analisar cardápio" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call:", JSON.stringify(data).slice(0, 1000));
      return new Response(JSON.stringify({ error: "IA não conseguiu extrair pratos do cardápio" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const args = JSON.parse(toolCall.function.arguments);
    const dishes: Array<{ name: string; description?: string | null; price?: number | null; category: string }> = args.dishes || [];

    if (dishes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum prato identificado no cardápio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Wipe previous extraction (only ones from menu_extraction, keep manual)
    await admin.from("restaurant_dishes").delete().eq("restaurant_id", restaurantId).eq("source", "menu_extraction");

    const rows = dishes.slice(0, 200).map((d) => ({
      restaurant_id: restaurantId,
      name: String(d.name).slice(0, 200),
      description: d.description ? String(d.description).slice(0, 500) : null,
      price: typeof d.price === "number" ? d.price : null,
      category: ["entrada", "prato_principal", "sobremesa", "bebida", "outro"].includes(d.category) ? d.category : "outro",
      source: "menu_extraction",
    }));

    const { error: insErr } = await admin.from("restaurant_dishes").insert(rows);
    if (insErr) {
      console.error("Insert error:", insErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar pratos" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("restaurants").update({ menu_dishes_extracted_at: new Date().toISOString() }).eq("id", restaurantId);

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-menu-dishes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
const isAbsoluteUrl = (v: string) => /^https?:\/\//i.test(v);

/** Map AI categories to the menu_dishes enum: entrada|principal|sobremesa|bebida|especial */
function mapCategory(c: string): "entrada" | "principal" | "sobremesa" | "bebida" | "especial" {
  const v = (c || "").toLowerCase();
  if (v.startsWith("entr")) return "entrada";
  if (v.includes("sobre")) return "sobremesa";
  if (v.includes("bebid")) return "bebida";
  if (v.includes("princ") || v === "prato_principal") return "principal";
  return "especial";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const restaurantId = String(body.restaurantId || "").slice(0, 36);
    if (!restaurantId) return json({ error: "restaurantId obrigatório" }, 400);

    // Validate ownership
    const { data: rest } = await admin
      .from("restaurants")
      .select("id, owner_id, menu_url")
      .eq("id", restaurantId)
      .maybeSingle();
    if (!rest) return json({ error: "Restaurante não encontrado" }, 404);
    if (rest.owner_id !== user.id) {
      const { data: isAdm } = await admin.rpc("is_admin", { user_id: user.id });
      if (!isAdm) return json({ error: "Forbidden" }, 403);
    }

    // menu_image_url lives in mesaclik schema
    let menuImageUrl: string | null = null;
    try {
      const { data: mRest } = await admin
        .schema("mesaclik" as any)
        .from("restaurants")
        .select("menu_url, menu_image_url")
        .eq("id", restaurantId)
        .maybeSingle();
      menuImageUrl = (mRest as any)?.menu_image_url || (mRest as any)?.menu_url || null;
    } catch (_) { /* ignore */ }

    const menuSource = (rest as any).menu_url || menuImageUrl;
    if (!menuSource || !isAbsoluteUrl(menuSource)) {
      return json({ error: "Cardápio não cadastrado. Anexe em Configurações → Cardápio." }, 400);
    }

    // Build media parts (image direct, PDF inlined as base64)
    const lower = menuSource.toLowerCase();
    const mediaParts: any[] = [];
    if (IMAGE_EXTENSIONS.some((ext) => lower.includes(ext))) {
      mediaParts.push({ type: "image_url", image_url: { url: menuSource } });
    } else if (lower.includes(".pdf")) {
      const r = await fetch(menuSource, { headers: { "User-Agent": "Mozilla/5.0 MesaClik" } });
      if (!r.ok) return json({ error: "Não consegui baixar o PDF do cardápio" }, 400);
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length > 18 * 1024 * 1024) return json({ error: "PDF muito grande (>18MB)" }, 400);
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      mediaParts.push({ type: "image_url", image_url: { url: `data:application/pdf;base64,${btoa(bin)}` } });
    } else {
      // Try as image URL anyway
      mediaParts.push({ type: "image_url", image_url: { url: menuSource } });
    }

    const prompt = `Você é um assistente que extrai pratos de cardápios de restaurantes em português brasileiro.

Analise o cardápio e devolva TODOS os itens encontrados.

Para cada item extraia:
- name: nome exato do prato
- description: descrição curta (até 120 caracteres) ou null
- price: número em reais (ex 49.90) ou null
- category: uma de "entrada", "principal", "sobremesa", "bebida", "especial"
- ingredients: array com 2-5 ingredientes principais inferidos do nome/descrição
- margin: "alta", "media" ou "baixa" (estime: massas/risotos/sobremesas tendem a alta, carnes nobres/peixes média, bebidas baixa)
- profiles: array, escolhas: "Família com crianças", "Casal romântico", "Executivos", "Grupo de amigos", "Cliente VIP", "Qualquer perfil"
- occasions: array, escolhas: "Almoço", "Jantar", "Fim de semana", "Feriado", "Qualquer hora"
- restrictions: array, escolhas: "Vegetariano", "Vegano", "Sem glúten", "Sem lactose", "Sem frutos do mar", "Sem carne vermelha", "Halal" (vazio se nenhuma)

NÃO invente pratos. Mantenha grafia original.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...mediaParts] }],
        tools: [{
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
                      category: { type: "string" },
                      ingredients: { type: "array", items: { type: "string" } },
                      margin: { type: "string" },
                      profiles: { type: "array", items: { type: "string" } },
                      occasions: { type: "array", items: { type: "string" } },
                      restrictions: { type: "array", items: { type: "string" } },
                    },
                    required: ["name", "category"],
                  },
                },
              },
              required: ["dishes"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_dishes" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Limite de requisições. Tente novamente em alguns segundos." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos de IA insuficientes." }, 402);
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return json({ error: "Falha ao analisar cardápio com IA" }, 500);
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "IA não conseguiu extrair pratos" }, 500);
    const args = JSON.parse(toolCall.function.arguments);
    const dishes: any[] = args.dishes || [];
    if (dishes.length === 0) return json({ error: "Nenhum prato identificado no cardápio" }, 400);

    // Avoid duplicates: load existing names for this restaurant
    const { data: existing } = await admin
      .from("menu_dishes")
      .select("name")
      .eq("restaurant_id", restaurantId)
      .eq("active", true);
    const existingNames = new Set((existing ?? []).map((r: any) => String(r.name).trim().toLowerCase()));

    const allowedMargins = new Set(["alta", "media", "baixa"]);
    const rows = dishes.slice(0, 200)
      .filter((d) => d?.name && !existingNames.has(String(d.name).trim().toLowerCase()))
      .map((d) => ({
        restaurant_id: restaurantId,
        name: String(d.name).slice(0, 200),
        description: d.description ? String(d.description).slice(0, 120) : null,
        price: typeof d.price === "number" ? d.price : null,
        category: mapCategory(d.category),
        ingredients: Array.isArray(d.ingredients) ? d.ingredients.slice(0, 10).map(String) : [],
        margin: allowedMargins.has(d.margin) ? d.margin : "media",
        profiles: Array.isArray(d.profiles) ? d.profiles.slice(0, 8).map(String) : [],
        occasions: Array.isArray(d.occasions) ? d.occasions.slice(0, 6).map(String) : [],
        restrictions: Array.isArray(d.restrictions) ? d.restrictions.slice(0, 8).map(String) : [],
      }));

    if (rows.length === 0) return json({ success: true, count: 0, skipped: dishes.length });

    const { error: insErr } = await admin.from("menu_dishes").insert(rows);
    if (insErr) {
      console.error("Insert error:", insErr);
      return json({ error: "Erro ao salvar pratos: " + insErr.message }, 500);
    }

    return json({ success: true, count: rows.length, skipped: dishes.length - rows.length });
  } catch (e) {
    console.error("import-menu-ai error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
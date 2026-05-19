import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function twiml(text: string, mediaUrl?: string) {
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const media = mediaUrl ? `<Media>${safe(mediaUrl)}</Media>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${media}<Body>${safe(text)}</Body></Message></Response>`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_dishes",
      description: "Lista pratos disponíveis (até 30). Use para sugerir ao cliente.",
      parameters: { type: "object", properties: { search: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "send_dish_image",
      description: "Gera e envia uma imagem do prato com o nome do cliente. Use quando recomendar um prato específico ou quando o cliente perguntar sobre um prato.",
      parameters: {
        type: "object",
        properties: {
          dish_id: { type: "string" },
          headline: { type: "string", description: "Frase curta de chamada, ex: 'Seu nhoque favorito te espera 🍝'" },
        },
        required: ["dish_id", "headline"],
      },
    },
  },
];

function normalizePhone(raw: string): string {
  // Twilio envia "whatsapp:+5511999998888"
  return raw.replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
}

async function upsertCustomer(restaurantId: string, phone: string, displayName?: string) {
  const digits = phone.replace(/\D/g, "");
  // Procura primeiro por telefone
  const { data: existing } = await admin
    .from("restaurant_customers")
    .select("id, customer_name")
    .eq("restaurant_id", restaurantId)
    .or(`customer_phone.eq.${phone},customer_phone.eq.+${digits}`)
    .maybeSingle();
  if (existing) return existing;

  const fallbackEmail = `${digits}@phone.local`;
  const { data: inserted, error } = await admin
    .from("restaurant_customers")
    .insert({
      restaurant_id: restaurantId,
      customer_name: displayName || `Cliente ${digits.slice(-4)}`,
      customer_phone: phone,
      customer_email: fallbackEmail,
      total_visits: 0,
      source: "whatsapp_bot",
    })
    .select("id, customer_name")
    .maybeSingle();
  if (error) console.error("upsertCustomer error:", error);
  return inserted;
}

async function buildContext(restaurantId: string, customerId: string | null, phone: string) {
  const { data: rest } = await admin.from("restaurants").select("name, about, cuisine").eq("id", restaurantId).maybeSingle();
  let customerCtx: any = { phone };
  if (customerId) {
    const { data: c } = await admin
      .from("restaurant_customers")
      .select("customer_name, total_visits, vip, last_seen_at, birthday")
      .eq("id", customerId).maybeSingle();
    if (c) customerCtx = { ...c, phone };
    const { data: prefs } = await admin
      .from("menu_customer_preferences")
      .select("dish_id, score, menu_dishes(name)")
      .eq("customer_id", customerId).order("score", { ascending: false }).limit(3);
    customerCtx.favorite_dishes = (prefs ?? []).map((p: any) => ({ dish_id: p.dish_id, name: p.menu_dishes?.name, score: p.score }));
  }
  // Histórico curto
  const { data: history } = await admin
    .from("whatsapp_messages")
    .select("direction, body, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(10);
  return { restaurant: rest, customer: customerCtx, history: (history ?? []).reverse() };
}

async function execTool(name: string, args: any, ctx: { restaurantId: string; customerName: string }) {
  switch (name) {
    case "list_dishes": {
      let q = admin.from("menu_dishes")
        .select("id, name, description, price, category, photo_url")
        .eq("restaurant_id", ctx.restaurantId).eq("active", true).limit(30);
      if (args?.search) q = q.ilike("name", `%${args.search}%`);
      const { data } = await q;
      return { dishes: data ?? [] };
    }
    case "send_dish_image": {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-dish-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          restaurantId: ctx.restaurantId,
          dishId: args.dish_id,
          customerName: ctx.customerName,
          headline: args.headline,
          useRealPhoto: true,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) return { error: j.error ?? `image failed (${r.status})` };
      return { ok: true, image_url: j.image_url, dish_name: j.dish_name };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}

async function runAgent(systemPrompt: string, userText: string, ctx: { restaurantId: string; customerName: string }) {
  const convo: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userText },
  ];
  const trace: any[] = [];
  let mediaUrl: string | undefined;

  for (let step = 0; step < 5; step++) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: convo,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("AI error", r.status, t);
      return { reply: "Desculpe, tive um problema agora. Pode repetir em alguns instantes? 🙏", mediaUrl: undefined, trace };
    }
    const data = await r.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) return { reply: "Ok!", mediaUrl, trace };
    const toolCalls = msg.tool_calls ?? [];
    if (!toolCalls.length) {
      return { reply: msg.content ?? "Ok!", mediaUrl, trace };
    }
    convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
    for (const tc of toolCalls) {
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch (_) { /* ignore */ }
      const result = await execTool(tc.function.name, args, ctx);
      trace.push({ name: tc.function.name, args, result });
      if (tc.function.name === "send_dish_image" && (result as any).image_url) {
        mediaUrl = (result as any).image_url;
      }
      convo.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result),
      });
    }
  }
  return { reply: "Tudo certo!", mediaUrl, trace };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("r");
  const secret = url.searchParams.get("s");
  if (!restaurantId) {
    return new Response("missing r param", { status: 400 });
  }

  // Twilio envia form-urlencoded
  const form = await req.formData();
  const from = (form.get("From") as string) || "";
  const to = (form.get("To") as string) || "";
  const body = (form.get("Body") as string) || "";
  const profileName = (form.get("ProfileName") as string) || undefined;
  const messageSid = (form.get("MessageSid") as string) || undefined;
  const numMedia = parseInt((form.get("NumMedia") as string) || "0", 10);
  const mediaIn = numMedia > 0 ? (form.get("MediaUrl0") as string) : undefined;

  // Carrega config + valida secret simples no path (defesa em profundidade)
  const { data: cred, error: credErr } = await admin.rpc("internal_get_whatsapp_credentials", { p_restaurant_id: restaurantId });
  if (credErr || !cred) {
    console.error("no cred", credErr);
    return new Response("config not found", { status: 404 });
  }
  if ((cred as any).webhook_secret !== secret) {
    return new Response("invalid secret", { status: 401 });
  }
  if ((cred as any).status !== "connected") {
    return new Response(twiml("Bot temporariamente indisponível."), { headers: { "Content-Type": "text/xml" } });
  }

  const phone = normalizePhone(from);
  const customer = await upsertCustomer(restaurantId, phone, profileName);

  // Log inbound
  await admin.rpc("log_whatsapp_message", {
    p_restaurant_id: restaurantId,
    p_customer_id: customer?.id ?? null,
    p_phone: phone,
    p_direction: "inbound",
    p_body: body,
    p_media_url: mediaIn ?? null,
    p_twilio_sid: messageSid ?? null,
    p_ai_tool_trace: null,
  });

  const ctxData = await buildContext(restaurantId, customer?.id ?? null, phone);
  const restName = ctxData.restaurant?.name ?? "restaurante";
  const customerName = customer?.customer_name ?? profileName ?? "amigo(a)";
  const visits = (ctxData.customer as any)?.total_visits ?? 0;
  const vip = (ctxData.customer as any)?.vip ? "Cliente VIP." : "";
  const favs = ((ctxData.customer as any)?.favorite_dishes ?? []).map((f: any) => f.name).filter(Boolean).join(", ");

  const systemPrompt = `Você é o atendente virtual do ${restName} no WhatsApp. Fale em português brasileiro, caloroso, breve (máx 3 frases por mensagem) e simpático. Use no máximo 1 emoji por mensagem.

CONTEXTO DO CLIENTE:
- Nome: ${customerName}
- Visitas no restaurante: ${visits}
- ${vip}
- Pratos favoritos: ${favs || "ainda não sabemos"}

O QUE VOCÊ PODE FAZER:
- Recomendar pratos do cardápio (use a ferramenta list_dishes).
- Enviar uma FOTO REAL do prato com o nome do cliente no overlay (ferramenta send_dish_image). USE essa ferramenta sempre que recomendar um prato específico ou o cliente perguntar sobre um prato; isso encanta e converte.
- Tirar dúvidas sobre o restaurante de forma simpática.

REGRAS:
- Cumprimente pelo nome quando souber.
- Se o cliente já tem prato favorito, lembre-o disso.
- Sempre que mandar imagem, escreva uma chamada curta no headline com o nome do cliente.
- Não invente pratos: use sempre list_dishes antes de mencionar nomes.
- Nunca peça dados sensíveis (CPF, cartão).`;

  const { reply, mediaUrl, trace } = await runAgent(systemPrompt, body || "(sem texto)", {
    restaurantId,
    customerName,
  });

  // Log outbound
  await admin.rpc("log_whatsapp_message", {
    p_restaurant_id: restaurantId,
    p_customer_id: customer?.id ?? null,
    p_phone: phone,
    p_direction: "outbound",
    p_body: reply,
    p_media_url: mediaUrl ?? null,
    p_twilio_sid: null,
    p_ai_tool_trace: trace as any,
  });

  return new Response(twiml(reply, mediaUrl), {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string; tool_calls?: any[]; name?: string };

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_customers",
      description: "Lista até 30 clientes do restaurante. Use search para filtrar por nome ou telefone.",
      parameters: {
        type: "object",
        properties: { search: { type: "string", description: "Texto para filtrar (opcional)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dishes",
      description: "Lista pratos do cardápio. Use search para filtrar por nome.",
      parameters: {
        type: "object",
        properties: { search: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_favorite_dish",
      description: "Marca um prato como predileto de um cliente (aprende a preferência).",
      parameters: {
        type: "object",
        properties: { customer_id: { type: "string" }, dish_id: { type: "string" } },
        required: ["customer_id", "dish_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_personalized_image",
      description: "Gera uma imagem personalizada do prato com o nome do cliente e uma chamada. Retorna a URL da imagem.",
      parameters: {
        type: "object",
        properties: {
          dish_id: { type: "string" },
          customer_name: { type: "string" },
          headline: { type: "string", description: "Texto curto (ex: 'Que saudade, Maria!')" },
          use_real_photo: { type: "boolean", description: "Se true, usa a foto anexada do prato com overlay; se false, gera 100% por IA." },
        },
        required: ["dish_id", "customer_name", "headline"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_campaign",
      description: "Agenda o envio de uma mensagem com imagem para o cliente em um horário futuro (ISO 8601).",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string" },
          dish_id: { type: "string" },
          message: { type: "string" },
          image_url: { type: "string" },
          scheduled_at: { type: "string", description: "ISO 8601, ex: 2026-05-13T19:00:00-03:00" },
        },
        required: ["customer_id", "dish_id", "message", "image_url", "scheduled_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_now",
      description: "Envia AGORA a mensagem com imagem para o cliente (cria a campanha e dispara).",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string" },
          dish_id: { type: "string" },
          message: { type: "string" },
          image_url: { type: "string" },
        },
        required: ["customer_id", "dish_id", "message", "image_url"],
      },
    },
  },
];

async function execTool(name: string, args: any, ctx: { restaurantId: string; userJwt: string }) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${ctx.userJwt}` } },
  });

  switch (name) {
    case "list_customers": {
      let q = admin
        .from("restaurant_customers")
        .select("id, customer_name, customer_phone, total_visits, vip, last_seen_at, marketing_optin, birthday")
        .eq("restaurant_id", ctx.restaurantId)
        .order("last_seen_at", { ascending: false })
        .limit(30);
      if (args?.search) {
        q = q.or(`customer_name.ilike.%${args.search}%,customer_phone.ilike.%${args.search}%`);
      }
      const { data, error } = await q;
      if (error) return { error: error.message };
      // Anexa preferências
      const ids = (data ?? []).map((c: any) => c.id);
      const { data: prefs } = ids.length
        ? await admin
            .from("menu_customer_preferences")
            .select("customer_id, dish_id, score, menu_dishes(name)")
            .in("customer_id", ids)
        : { data: [] as any[] };
      const byCust: Record<string, any[]> = {};
      (prefs ?? []).forEach((p: any) => {
        (byCust[p.customer_id] ||= []).push({ dish_id: p.dish_id, dish_name: p.menu_dishes?.name, score: p.score });
      });
      return {
        customers: (data ?? []).map((c: any) => ({ ...c, favorite_dishes: byCust[c.id] ?? [] })),
      };
    }

    case "list_dishes": {
      let q = admin
        .from("menu_dishes")
        .select("id, name, description, price, category, profiles, photo_url")
        .eq("restaurant_id", ctx.restaurantId)
        .eq("active", true)
        .limit(50);
      if (args?.search) q = q.ilike("name", `%${args.search}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { dishes: data ?? [] };
    }

    case "set_favorite_dish": {
      const { data, error } = await userClient.rpc("set_customer_favorite_dish", {
        p_restaurant_id: ctx.restaurantId,
        p_customer_id: args.customer_id,
        p_dish_id: args.dish_id,
        p_source: "ia_chat",
      });
      if (error) return { error: error.message };
      return { ok: true, preference_id: data };
    }

    case "generate_personalized_image": {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-dish-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.userJwt}` },
        body: JSON.stringify({
          restaurantId: ctx.restaurantId,
          dishId: args.dish_id,
          customerName: args.customer_name,
          headline: args.headline,
          useRealPhoto: args.use_real_photo ?? true,
        }),
      });
      const json = await r.json();
      return json;
    }

    case "schedule_campaign": {
      const { data, error } = await userClient.rpc("schedule_dish_campaign", {
        p_restaurant_id: ctx.restaurantId,
        p_customer_id: args.customer_id,
        p_dish_id: args.dish_id,
        p_message: args.message,
        p_image_url: args.image_url,
        p_scheduled_at: args.scheduled_at,
      });
      if (error) return { error: error.message };
      return { ok: true, campaign_id: data, scheduled_at: args.scheduled_at };
    }

    case "send_now": {
      const nowIso = new Date(Date.now() - 1000).toISOString();
      const { data: cid, error } = await userClient.rpc("schedule_dish_campaign", {
        p_restaurant_id: ctx.restaurantId,
        p_customer_id: args.customer_id,
        p_dish_id: args.dish_id,
        p_message: args.message,
        p_image_url: args.image_url,
        p_scheduled_at: nowIso,
      });
      if (error) return { error: error.message };
      // Dispara já
      await fetch(`${SUPABASE_URL}/functions/v1/dispatch-dish-campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({}),
      });
      return { ok: true, campaign_id: cid, dispatched: true };
    }

    default:
      return { error: `unknown tool ${name}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const userJwt = auth.replace("Bearer ", "");

    const { messages, restaurantId } = await req.json();
    if (!restaurantId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "restaurantId and messages required" }), { status: 400, headers: corsHeaders });
    }

    // Verifica acesso ao restaurante
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const systemPrompt = `Você é o assistente do Cardápio Inteligente do MesaClik.
Sua missão: ajudar o dono do restaurante a entender quais pratos cada cliente prefere e disparar campanhas personalizadas (imagem + mensagem) via WhatsApp/SMS.
Sempre que o usuário pedir para enviar/agendar algo:
 1) Use list_customers para encontrar o cliente.
 2) Use list_dishes para encontrar o prato.
 3) Gere uma imagem personalizada (generate_personalized_image) com o nome do cliente e uma headline curta.
 4) Confirme com o usuário a data/hora antes de chamar schedule_campaign ou send_now.
 5) Após sucesso, marque o prato como predileto (set_favorite_dish) para a IA aprender.
Seja direto, em português brasileiro, e mostre o que está sendo feito.`;

    const ctx = { restaurantId, userJwt };
    const convo: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...messages];
    const toolTrace: any[] = [];

    // Loop de até 6 passos
    for (let step = 0; step < 6; step++) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (r.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Aguarde alguns instantes." }), { status: 429, headers: corsHeaders });
      }
      if (r.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Configurações." }), { status: 402, headers: corsHeaders });
      }
      if (!r.ok) {
        const txt = await r.text();
        return new Response(JSON.stringify({ error: `IA falhou: ${txt}` }), { status: 500, headers: corsHeaders });
      }

      const data = await r.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return new Response(JSON.stringify({ error: "Sem resposta da IA" }), { status: 500, headers: corsHeaders });

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // resposta final
        return new Response(
          JSON.stringify({ reply: msg.content ?? "", tool_trace: toolTrace }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch (_) { /* ignore */ }
        const result = await execTool(tc.function.name, args, ctx);
        toolTrace.push({ name: tc.function.name, args, result });
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(JSON.stringify({ reply: "Não consegui concluir em poucos passos.", tool_trace: toolTrace }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "erro" }), { status: 500, headers: corsHeaders });
  }
});
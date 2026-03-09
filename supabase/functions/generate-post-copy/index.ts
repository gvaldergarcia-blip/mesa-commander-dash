import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const body = await req.json();

    const str = (v: any, max = 200) => typeof v === "string" ? v.slice(0, max) : "";
    const postType = str(body.postType, 50);
    const dishName = str(body.dishName, 100);
    const priceOld = str(body.priceOld, 20);
    const priceNew = str(body.priceNew, 20);
    const validity = str(body.validity, 100);
    const tone = str(body.tone, 50);
    const restaurantName = str(body.restaurantName, 100);
    const cuisineType = str(body.cuisineType, 50);

    if (!dishName) {
      return new Response(
        JSON.stringify({ error: "Nome do prato ou campanha é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate discount if both prices exist
    let discountText = "";
    if (priceOld && priceNew) {
      const oldNum = parseFloat(priceOld.replace(/[^\d.,]/g, "").replace(",", "."));
      const newNum = parseFloat(priceNew.replace(/[^\d.,]/g, "").replace(",", "."));
      if (oldNum > 0 && newNum > 0 && oldNum > newNum) {
        const pct = Math.round(((oldNum - newNum) / oldNum) * 100);
        discountText = `${pct}% OFF`;
      }
    }

    const systemPrompt = `Você é um especialista em marketing para restaurantes e copywriter profissional para Instagram. Seu objetivo é criar copies curtos, diretos e altamente persuasivos para posts de restaurantes.

Regras obrigatórias:
- Máximo 2 linhas no título (headline)
- Máximo 1 linha no subtítulo
- Sempre incluir urgência quando houver promoção
- Usar o nome do prato de forma apetitosa e descritiva
- Incluir 1 CTA claro e direto no final
- Adaptar completamente ao tom de voz escolhido
- NUNCA usar placeholders ou textos genéricos
- NUNCA usar emojis que não combinem com o contexto do prato
- Todos os textos devem ser em português brasileiro
- Tom deve ser adequado para o setor de alimentação`;

    const userPrompt = `Gere um copy para um post de Instagram do restaurante "${restaurantName}" (${cuisineType}).

Tipo de post: ${postType}
Prato/Campanha: ${dishName}
${priceOld ? `Preço original: R$ ${priceOld}` : ""}
${priceNew ? `Preço promocional: R$ ${priceNew}` : ""}
${discountText ? `Desconto calculado: ${discountText}` : ""}
${validity ? `Validade: ${validity}` : ""}
Tom de voz: ${tone}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_instagram_copy",
              description: "Generate Instagram post copy for a restaurant",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "Main headline text (max 2 lines)" },
                  subheadline: { type: "string", description: "Secondary text (max 1 line)" },
                  priceOld: { type: "string", description: "Original price formatted (e.g. R$ 90). Empty if no price." },
                  priceNew: { type: "string", description: "Promotional price formatted (e.g. R$ 50). Empty if no price." },
                  discount: { type: "string", description: "Discount text (e.g. 44% OFF). Empty if no discount." },
                  urgency: { type: "string", description: "Urgency text for the promotion. Empty if not applicable." },
                  cta: { type: "string", description: "Call to action text" },
                  caption: { type: "string", description: "Full Instagram caption with emojis and hashtags" },
                  hashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of relevant hashtags (without #)",
                  },
                },
                required: ["headline", "subheadline", "cta", "caption", "hashtags"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_instagram_copy" } },
      }),
    });

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
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data).substring(0, 1000));
      throw new Error("IA não retornou o copy corretamente. Tente novamente.");
    }

    let copyData;
    try {
      copyData = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      throw new Error("Erro ao processar resposta da IA.");
    }

    console.log("Copy generated for:", dishName, "type:", postType);

    return new Response(JSON.stringify({ copy: copyData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-post-copy error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

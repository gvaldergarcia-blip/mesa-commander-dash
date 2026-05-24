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
    const dishName = str(body.dishName, 100);
    const objetivo = str(body.objetivo, 80);
    const dia = str(body.dia, 40);
    const publico = str(body.publico, 60);
    const tom = str(body.tom, 40);
    const hasDiscount = body.hasDiscount ? "sim" : "nao";
    const frase = str(body.frase, 200);

    if (!dishName) {
      return new Response(
        JSON.stringify({ error: "Nome do prato ou campanha é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um copywriter especialista em marketing para restaurantes brasileiros. Gere textos curtos, específicos e persuasivos para post de Instagram.

Regras obrigatórias:
1. HEADLINE: máximo 8 palavras, específica sobre o prato ou a ocasião. NUNCA use "elegância no prato", "experiência gastronômica" ou frases genéricas. Use o nome real do prato ou uma provocação direta. Exemplos bons: "Risoto cremoso que só existe às terças." / "Filé mignon que faz amigos voltarem." / "Shitake + filé. Combinação que não existe em outro lugar."

2. SUBHEADLINE: 1 frase de apoio que conecta o objetivo com o público. Se objetivo for aumentar ticket médio: fale em valor da experiência. Se for atrair em dia fraco: crie urgência no dia específico. Se for fidelizar: fale em exclusividade.

3. CTA: ação real e possível no Instagram. NUNCA "peça já" — o cliente não consegue pedir pela imagem. Use: "Reserve sua mesa", "Garanta sua vaga hoje", "Chega cedo, acaba rápido", "Só {dia}, só no jantar".

4. Máximo 3 variações. Cada uma com abordagem diferente: emocional, racional e urgência.`;

    const userPrompt = `Dados da campanha:
- Prato: ${dishName}
- Objetivo: ${objetivo || "não informado"}
- Dia: ${dia || "não informado"}
- Público-alvo: ${publico || "geral"}
- Tom de voz: ${tom || "neutro"}
- Tem desconto: ${hasDiscount}
- Frase do restaurante: ${frase || "(nenhuma)"}`;

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
              name: "generate_campaign_variations",
              description: "Gera até 3 variações de copy (emocional, racional, urgência) para post de Instagram de restaurante.",
              parameters: {
                type: "object",
                properties: {
                  variacoes: {
                    type: "array",
                    description: "Lista de até 3 variações: emocional, racional, urgência.",
                    items: {
                      type: "object",
                      properties: {
                        headline: { type: "string", description: "Máx. 8 palavras, específica sobre o prato/ocasião." },
                        subheadline: { type: "string", description: "1 frase de apoio." },
                        cta: { type: "string", description: "Ação real e possível no Instagram." },
                      },
                      required: ["headline", "subheadline", "cta"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["variacoes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_campaign_variations" } },
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

    console.log("Copy generated for:", dishName, "objetivo:", objetivo);

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

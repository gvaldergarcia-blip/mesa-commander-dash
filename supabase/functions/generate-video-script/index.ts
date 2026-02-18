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
    const { restaurantName, dishName, promotion, freeText, tone, duration } =
      await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const toneDescriptions: Record<string, string> = {
      sofisticado:
        "Tom sofisticado e elegante. Linguagem refinada, voz pausada e confiante. Como um sommelier apresentando uma experiência gastronômica.",
      jovem:
        "Tom jovem e descontraído. Linguagem moderna, dinâmica, com energia. Como um influenciador de gastronomia empolgado.",
      familiar:
        "Tom acolhedor e familiar. Linguagem calorosa, próxima, como um amigo convidando para jantar em casa.",
      gourmet:
        "Tom gourmet e técnico. Linguagem que destaca ingredientes, técnicas culinárias e a arte da gastronomia.",
    };

    const toneDesc = toneDescriptions[tone] || toneDescriptions.sofisticado;

    const systemPrompt = `Você é um roteirista profissional de vídeos publicitários para restaurantes brasileiros.
Seu trabalho é criar roteiros de narração para vídeos curtos de Instagram/WhatsApp.

REGRAS OBRIGATÓRIAS:
- Escreva APENAS o texto que será FALADO pelo apresentador
- Use português brasileiro natural e fluente
- Divida em seções claras: INTRO, PRATO, PROMO (se houver), CTA
- Cada seção deve ter marcação [INTRO], [PRATO], [PROMO], [CTA]
- O tempo total de fala deve caber em ${duration} segundos (aproximadamente ${Math.round(duration * 2.5)} palavras)
- ${toneDesc}
- Termine SEMPRE com uma chamada para ação clara
- NÃO inclua instruções de câmera ou ações, apenas texto falado
- NÃO use emojis`;

    const userPrompt = `Crie um roteiro de narração para o restaurante "${restaurantName}".

Prato em destaque: ${dishName}
${promotion ? `Promoção: ${promotion}` : "Sem promoção especial."}
${freeText ? `Informações adicionais do restaurante: ${freeText}` : ""}

Duração do vídeo: ${duration} segundos
Tom desejado: ${tone}

Gere o roteiro com as seções [INTRO], [PRATO], ${promotion ? "[PROMO], " : ""}[CTA].`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Limite de requisições excedido. Tente novamente em alguns segundos.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const scriptText =
      data.choices?.[0]?.message?.content || "Erro ao gerar roteiro.";

    // Parse sections
    const sections = parseScript(scriptText);

    return new Response(
      JSON.stringify({ script: scriptText, sections }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-video-script error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseScript(text: string): { tag: string; text: string }[] {
  const sections: { tag: string; text: string }[] = [];
  const regex = /\[(INTRO|PRATO|PROMO|CTA)\]\s*/gi;
  let lastIndex = 0;
  let lastTag = "INTRO";
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex && lastIndex > 0) {
      const content = text.slice(lastIndex, match.index).trim();
      if (content) sections.push({ tag: lastTag, text: content });
    }
    lastTag = match[1].toUpperCase();
    lastIndex = regex.lastIndex;
  }

  // Last section
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    sections.push({ tag: lastTag, text: remaining });
  }

  // If no sections found, treat entire text as INTRO
  if (sections.length === 0 && text.trim()) {
    sections.push({ tag: "INTRO", text: text.trim() });
  }

  return sections;
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScriptRequest {
  headline: string;
  subtext?: string;
  cta?: string;
  restaurantName: string;
  templateId: string;
  duration: 7 | 15 | 30;
  promotion?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ScriptRequest = await req.json();
    const { headline, subtext, cta, restaurantName, templateId, duration, promotion } = body;

    if (!headline || !restaurantName || !templateId || !duration) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: headline, restaurantName, templateId, duration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map template to tone
    const toneMap: Record<string, string> = {
      elegante: "sofisticado, refinado, elegante — tom de restaurante premium",
      dinamico: "empolgado, vibrante, energético — tom moderno e jovem",
      kenburns: "cinematográfico, envolvente, narrativo — tom de documentário gastronômico",
      moderno: "direto, bold, impactante — tom contemporâneo e confiante",
      minimalista: "minimalista, clean, direto ao ponto — tom editorial e discreto",
    };
    const tone = toneMap[templateId] || toneMap.elegante;

    // Duration guidance
    const durationGuide: Record<number, string> = {
      7: "MUITO curto (7 segundos). Máximo 2 frases. Cada frase deve ter no máximo 8 palavras. Seja extremamente conciso.",
      15: "Curto (15 segundos). Máximo 4 frases. Cada frase deve ter no máximo 12 palavras. Seja conciso e impactante.",
      30: "Médio (30 segundos). Máximo 6 frases. Cada frase deve ter no máximo 15 palavras. Desenvolva a narrativa com calma.",
    };

    const systemPrompt = `Você é um roteirista profissional especializado em vídeos curtos para restaurantes no Instagram/Reels.
Sua missão é criar roteiros de narração em Português BR que sejam naturais, persuasivos e premium.

REGRAS OBRIGATÓRIAS:
- Português BR (nunca use PT-PT)
- Sem gírias ou informalidade excessiva
- Sem exageros repetitivos (nunca use "imperdível", "incrível", "sensacional" mais de uma vez)
- Natural e persuasivo, como um locutor profissional
- O texto deve caber EXATAMENTE na duração selecionada quando lido em voz alta
- Se não houver promoção informada, NÃO invente promoção
- O tom deve seguir o estilo do template escolhido

FORMATO DE SAÍDA (JSON):
Retorne EXATAMENTE este formato JSON:
{
  "segments": [
    {"type": "abertura", "text": "frase de abertura", "duration_hint": "Xs"},
    {"type": "destaque", "text": "destaque do prato/experiência", "duration_hint": "Xs"},
    {"type": "promocao", "text": "promoção se houver", "duration_hint": "Xs"},
    {"type": "cta", "text": "chamada final", "duration_hint": "Xs"}
  ],
  "full_narration": "texto completo da narração em uma única string"
}

Se não houver promoção, omita o segmento "promocao".
Se não houver CTA, omita o segmento "cta".
Sempre inclua "abertura" e "destaque".`;

    const userPrompt = `Crie um roteiro de narração para vídeo de restaurante com estas informações:

- Restaurante: ${restaurantName}
- Headline: ${headline}
${subtext ? `- Subtexto: ${subtext}` : ""}
${promotion ? `- Promoção: ${promotion}` : "- Promoção: Nenhuma (NÃO invente)"}
${cta ? `- CTA final: ${cta}` : "- CTA: Nenhum"}
- Template/Tom: ${tone}
- Duração: ${durationGuide[duration]}

Gere o roteiro profissional seguindo EXATAMENTE o formato JSON especificado.`;

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar roteiro" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let scriptData;
    try {
      scriptData = JSON.parse(jsonStr);
    } catch {
      // Fallback: try to find JSON object in the response
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) {
        scriptData = JSON.parse(objMatch[0]);
      } else {
        return new Response(
          JSON.stringify({ error: "Formato de resposta inválido", raw: content }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify(scriptData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-video-script error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

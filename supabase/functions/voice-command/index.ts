import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NLU_SYSTEM = `Você é o assistente operacional de uma cozinha profissional.
Recebe um comando de voz transcrito de um funcionário e devolve APENAS JSON válido (sem markdown).

Intents possíveis:
- "consumption"  (uso/consumo de um ingrediente na produção)
- "loss"         (perda / desperdício / quebra / vencido)
- "receipt"      (chegou / recebi um produto de fornecedor)
- "transfer"     (levei X para outra área/geladeira)
- "stock_check"  (acabou / está faltando / tem pouco)
- "unknown"      (não deu pra entender com confiança)

Formato:
{
  "intent": "<uma das intents>",
  "confidence": 0.0-1.0,
  "product_name_raw": string|null,       // como o usuário falou
  "product_id": string|null,             // id do catálogo se casar sem ambiguidade
  "quantity": number|null,
  "unit": "g"|"kg"|"ml"|"l"|"un"|null,
  "reason": string|null,                 // ex.: "vencido", "queimou", "caiu no chão"
  "notes": string|null
}

Regras:
- Converta unidades faladas ("dois quilos" -> quantity:2, unit:"kg"; "500 gramas" -> 500, "g").
- Se o usuário disser só "acabou o X" => intent:"stock_check", quantity:null, unit:null.
- product_id: escolha SOMENTE se o nome falado bater claramente com um item do catálogo abaixo. Em dúvida, deixe null e coloque o texto em product_name_raw.
- confidence < 0.6 quando faltar quantidade/unidade em intents que precisam (consumption/loss/receipt/transfer).
- NUNCA invente produto ou quantidade. NUNCA use markdown. Apenas JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const restaurantId = String(form.get("restaurant_id") ?? "");
    const filenameHint = String(form.get("filename") ?? "audio.webm");
    if (!file) {
      return new Response(JSON.stringify({ error: "Envie o arquivo 'file'." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) STT
    const sttForm = new FormData();
    sttForm.append("model", "openai/gpt-4o-transcribe");
    sttForm.append("file", file, filenameHint);
    sttForm.append("language", "pt");

    const sttRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: sttForm,
    });
    if (!sttRes.ok) {
      const t = await sttRes.text();
      console.error("STT error", sttRes.status, t);
      return new Response(JSON.stringify({ error: "Falha na transcrição", details: t }), {
        status: sttRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sttJson = await sttRes.json();
    const transcript: string = (sttJson?.text || "").trim();
    if (!transcript) {
      return new Response(JSON.stringify({ error: "Áudio vazio ou inaudível." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Carrega catálogo curto de produtos para desambiguar
    let catalog: { id: string; name: string }[] = [];
    if (restaurantId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data } = await supabase
        .from("label_products")
        .select("id,name")
        .eq("restaurant_id", restaurantId)
        .limit(300);
      catalog = (data as any[]) || [];
    }
    const catalogText = catalog.length
      ? "\n\nCatálogo (id | nome):\n" + catalog.map((p) => `${p.id} | ${p.name}`).join("\n")
      : "\n\n(Sem catálogo disponível — deixe product_id null.)";

    // 3) NLU
    const nluRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: NLU_SYSTEM + catalogText },
          { role: "user", content: `Comando falado: "${transcript}"` },
        ],
      }),
    });
    if (!nluRes.ok) {
      const t = await nluRes.text();
      console.error("NLU error", nluRes.status, t);
      return new Response(JSON.stringify({ error: "Falha na interpretação", transcript, details: t }), {
        status: nluRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const nluJson = await nluRes.json();
    let raw: string = nluJson?.choices?.[0]?.message?.content ?? "{}";
    raw = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let interp: any;
    try { interp = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      interp = m ? JSON.parse(m[0]) : { intent: "unknown", confidence: 0 };
    }

    return new Response(JSON.stringify({ transcript, interpretation: interp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-command fatal", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
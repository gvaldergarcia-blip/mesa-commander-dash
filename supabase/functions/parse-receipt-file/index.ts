import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você extrai itens de notas fiscais, listas de fornecedor ou pedidos de recebimento de restaurantes.
Retorne APENAS JSON válido no formato:
{"supplier": string|null, "reference": string|null, "items": [{"raw_name": string, "quantity": number, "unit": "un"|"kg"|"g"|"l"|"ml"|"cx"}]}
Regras:
- Use o nome do produto EXATAMENTE como aparece na lista (não normalize).
- quantity numérico (aceite vírgula decimal e converta para ponto).
- unit: mapeie para uma das opções válidas; se não souber, use "un".
- Ignore cabeçalhos, totais, impostos, valores e endereços.
- Sem texto explicativo, sem markdown, apenas o JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, mime_type, filename } = await req.json();
    if (!file_base64 || !mime_type) {
      return new Response(JSON.stringify({ error: "file_base64 e mime_type obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isImage = mime_type.startsWith("image/");
    const isPdf = mime_type === "application/pdf";

    const userContent: any[] = [
      { type: "text", text: "Extraia os itens desta lista/nota de recebimento." },
    ];
    if (isImage) {
      userContent.push({ type: "image_url", image_url: { url: `data:${mime_type};base64,${file_base64}` } });
    } else if (isPdf) {
      userContent.push({ type: "file", file: { filename: filename || "nota.pdf", file_data: `data:${mime_type};base64,${file_base64}` } });
    } else {
      return new Response(JSON.stringify({ error: "Formato não suportado. Use imagem ou PDF." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gateway error", res.status, errText);
      return new Response(JSON.stringify({ error: "Falha ao analisar arquivo", status: res.status, details: errText }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? "";
    // Strip markdown fences se vierem
    raw = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch {
      // Tenta extrair primeiro objeto JSON
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error("Resposta da IA não é JSON válido: " + raw.slice(0, 200));
    }

    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const clean = items
      .map((it: any) => ({
        raw_name: String(it.raw_name || "").trim(),
        quantity: Number(String(it.quantity ?? 1).replace(",", ".")) || 1,
        unit: ["un","kg","g","l","ml","cx"].includes(it.unit) ? it.unit : "un",
      }))
      .filter((it: any) => it.raw_name);

    return new Response(JSON.stringify({
      supplier: parsed?.supplier || null,
      reference: parsed?.reference || null,
      items: clean,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("parse-receipt-file error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
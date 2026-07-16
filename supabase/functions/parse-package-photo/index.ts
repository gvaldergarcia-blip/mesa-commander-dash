import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você lê fotos de etiquetas de embalagens de produtos alimentícios (rótulos originais do fornecedor).
Extraia APENAS o que estiver legível na foto e retorne SOMENTE JSON válido:
{"name": string|null, "brand": string|null, "batch": string|null, "expires_at": "YYYY-MM-DD"|null, "manufactured_at": "YYYY-MM-DD"|null, "weight": string|null, "sif": string|null, "missing": string[]}

Regras:
- Datas SEMPRE em ISO YYYY-MM-DD. Se o rótulo mostrar DD/MM/AAAA ou DD/MM/AA, converta (assuma 20AA para anos de 2 dígitos).
- Se aparecer só validade em dias/meses sem data absoluta, deixe expires_at null.
- weight: mantenha unidade original (ex.: "500 g", "1 kg", "1L").
- sif: apenas o número (ex.: "358"). Ignore se não houver.
- Não invente nada. Campos ilegíveis => null e adicione o nome do campo ao array "missing".
- Sem markdown, sem texto extra, apenas o JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, mime_type } = await req.json();
    if (!file_base64 || !mime_type?.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "Envie uma imagem (file_base64 + mime_type)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: [
            { type: "text", text: "Leia esta etiqueta do fornecedor e extraia os dados." },
            { type: "image_url", image_url: { url: `data:${mime_type};base64,${file_base64}` } },
          ]},
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gateway error", res.status, errText);
      return new Response(JSON.stringify({ error: "Falha ao ler foto", status: res.status, details: errText }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? "";
    raw = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error("Resposta da IA não é JSON válido: " + raw.slice(0, 200));
    }

    const clean = {
      name: parsed?.name || null,
      brand: parsed?.brand || null,
      batch: parsed?.batch || null,
      expires_at: /^\d{4}-\d{2}-\d{2}$/.test(parsed?.expires_at || "") ? parsed.expires_at : null,
      manufactured_at: /^\d{4}-\d{2}-\d{2}$/.test(parsed?.manufactured_at || "") ? parsed.manufactured_at : null,
      weight: parsed?.weight || null,
      sif: parsed?.sif ? String(parsed.sif).replace(/\D/g, "") || null : null,
      missing: Array.isArray(parsed?.missing) ? parsed.missing : [],
    };

    return new Response(JSON.stringify(clean), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("parse-package-photo error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
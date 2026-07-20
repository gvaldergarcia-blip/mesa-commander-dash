import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lê 1 foto (que pode conter 1 ou VÁRIOS produtos) e cruza com a lista de
// candidatos (raw_names do recebimento) para descobrir a qual item pertence
// cada etiqueta lida. Retorna array de extrações com score de confiança.
const SYSTEM = `Você é um assistente de recebimento de restaurante.
Recebe UMA foto que pode conter UMA ou VÁRIAS etiquetas/embalagens de produtos alimentícios,
e uma lista de "candidatos" (nomes de produtos que o restaurante acabou de receber do fornecedor).

Para cada etiqueta/produto que você conseguir identificar na foto, retorne um objeto no array "labels":
{
  "match": string|null,           // nome do candidato que melhor corresponde (EXATAMENTE como veio na lista) ou null
  "confidence": number,           // 0..1 — quão certo você está do casamento
  "name": string|null,            // nome oficial impresso no rótulo (ex: "Molho de tomate tradicional Heinz")
  "brand": string|null,
  "batch": string|null,
  "expires_at": "YYYY-MM-DD"|null,
  "manufactured_at": "YYYY-MM-DD"|null,
  "weight": string|null,          // com unidade original ("500 g", "1 kg", "1L")
  "sif": string|null,             // só número
  "conservation": "refrigerated"|"frozen"|"ambient"|"hot"|null
}

Regras:
- Datas SEMPRE ISO YYYY-MM-DD; converta DD/MM/AAAA. Ano de 2 dígitos = 20AA.
- Nunca invente. Campo ilegível => null.
- "conservation" só se estiver claramente indicado (ex.: "Conservar refrigerado" => refrigerated, "Congelado" => frozen, "Ambiente/Seco" => ambient).
- "match" deve ser um dos strings da lista de candidatos, exato. Se nenhum bater com pelo menos 0.5 de confiança, use null.
- Retorne SOMENTE JSON válido, sem markdown: {"labels":[...]}`;

async function readOne(fileBase64: string, mimeType: string, candidates: string[], apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [
          { type: "text", text: `Lista de candidatos recebidos hoje:\n${candidates.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nLeia a foto abaixo e retorne o JSON.` },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
        ] },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gateway ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  let raw: string = data?.choices?.[0]?.message?.content ?? "";
  raw = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(raw); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Resposta IA inválida: " + raw.slice(0, 200));
  }
}

function clean(l: any) {
  return {
    match: typeof l?.match === "string" ? l.match : null,
    confidence: typeof l?.confidence === "number" ? Math.max(0, Math.min(1, l.confidence)) : 0,
    name: l?.name || null,
    brand: l?.brand || null,
    batch: l?.batch || null,
    expires_at: /^\d{4}-\d{2}-\d{2}$/.test(l?.expires_at || "") ? l.expires_at : null,
    manufactured_at: /^\d{4}-\d{2}-\d{2}$/.test(l?.manufactured_at || "") ? l.manufactured_at : null,
    weight: l?.weight || null,
    sif: l?.sif ? String(l.sif).replace(/\D/g, "") || null : null,
    conservation: ["refrigerated", "frozen", "ambient", "hot"].includes(l?.conservation) ? l.conservation : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { photos, candidates } = await req.json();
    if (!Array.isArray(photos) || !photos.length) {
      return new Response(JSON.stringify({ error: "Envie pelo menos 1 foto em `photos`." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cands: string[] = Array.isArray(candidates) ? candidates.filter((s: any) => typeof s === "string") : [];

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ photo_index: number; labels: any[] }> = [];
    // Processa em paralelo (limite prático: quem chama envia poucas fotos por vez).
    await Promise.all(photos.map(async (p: any, idx: number) => {
      try {
        if (!p?.base64 || !p?.mime_type) { results[idx] = { photo_index: idx, labels: [] }; return; }
        const parsed = await readOne(p.base64, p.mime_type, cands, apiKey);
        const labels = Array.isArray(parsed?.labels) ? parsed.labels.map(clean) : [];
        results[idx] = { photo_index: idx, labels };
      } catch (e) {
        console.error("photo", idx, e);
        results[idx] = { photo_index: idx, labels: [] };
      }
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("parse-labels-batch error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
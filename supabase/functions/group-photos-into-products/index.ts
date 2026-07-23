import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Recebe várias fotos que juntas representam UM ou VÁRIOS produtos.
 * A IA deve:
 *  1) Agrupar as fotos por produto (uma mesma embalagem pode aparecer em várias fotos: frente, verso, lote, validade, SIF, código de barras...).
 *  2) Para cada grupo, extrair todos os campos usando o conjunto de fotos.
 *  3) Retornar confiança por campo. Nunca inventar dados.
 */
const SYSTEM = `Você é um assistente de recebimento de restaurante.
Você recebe VÁRIAS fotografias de embalagens de alimentos. Cada foto tem um índice (0-based) na ordem enviada.

Seu trabalho:
1) AGRUPAR as fotos que pertencem ao MESMO produto físico. Use nome, marca, código de barras, logotipo, layout, peso, formato, semelhança visual e ordem das fotos. Uma mesma embalagem pode aparecer em várias fotos (frente/verso/lateral/etiqueta do fabricante/lote/validade/SIF/código de barras).
2) Para cada grupo, ANALISAR TODAS as fotos juntas e extrair os campos abaixo. Cada campo pode vir de uma foto diferente.
3) NUNCA inventar. Se um campo não aparece em NENHUMA foto do grupo, deixe null e coloque em "missing".

Retorne SOMENTE JSON válido, sem markdown, no formato:
{
  "products": [
    {
      "photo_indices": [number, ...],
      "name": string|null,
      "brand": string|null,
      "barcode": string|null,
      "weight": string|null,          // "500 g", "1 kg", "1L"
      "expires_at": "YYYY-MM-DD"|null,
      "manufactured_at": "YYYY-MM-DD"|null,
      "batch": string|null,
      "sif": string|null,             // só número
      "category": string|null,
      "conservation": "refrigerated"|"frozen"|"ambient"|"hot"|null,
      "confidence": {                 // 0..1 por campo lido
        "name": number, "brand": number, "barcode": number, "weight": number,
        "expires_at": number, "manufactured_at": number, "batch": number,
        "sif": number, "category": number, "conservation": number
      },
      "missing": [string, ...]        // nomes dos campos ausentes (ex.: "batch","expires_at","sif")
    }
  ]
}

Regras:
- Datas SEMPRE ISO YYYY-MM-DD. Converta DD/MM/AAAA. Ano de 2 dígitos = 20AA.
- Se conservação não aparecer explícita, deixe null.
- Se nome não aparece em NENHUMA foto do grupo, "name" = null e adicione "name" em missing.
- "missing" deve conter obrigatoriamente ao menos: name, expires_at, batch, sif — sempre que qualquer um deles for null.`;

function clampConf(n: any): number {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function cleanProduct(p: any) {
  const conf = p?.confidence || {};
  const out: any = {
    photo_indices: Array.isArray(p?.photo_indices) ? p.photo_indices.filter((n: any) => Number.isInteger(n) && n >= 0) : [],
    name: p?.name || null,
    brand: p?.brand || null,
    barcode: p?.barcode ? String(p.barcode).replace(/\D/g, "") || null : null,
    weight: p?.weight || null,
    expires_at: /^\d{4}-\d{2}-\d{2}$/.test(p?.expires_at || "") ? p.expires_at : null,
    manufactured_at: /^\d{4}-\d{2}-\d{2}$/.test(p?.manufactured_at || "") ? p.manufactured_at : null,
    batch: p?.batch || null,
    sif: p?.sif ? String(p.sif).replace(/\D/g, "") || null : null,
    category: p?.category || null,
    conservation: ["refrigerated", "frozen", "ambient", "hot"].includes(p?.conservation) ? p.conservation : null,
    confidence: {
      name: clampConf(conf.name),
      brand: clampConf(conf.brand),
      barcode: clampConf(conf.barcode),
      weight: clampConf(conf.weight),
      expires_at: clampConf(conf.expires_at),
      manufactured_at: clampConf(conf.manufactured_at),
      batch: clampConf(conf.batch),
      sif: clampConf(conf.sif),
      category: clampConf(conf.category),
      conservation: clampConf(conf.conservation),
    },
    missing: [] as string[],
  };
  // Recalcula missing por segurança
  const required = ["name", "expires_at", "batch", "sif"];
  const miss = new Set<string>(Array.isArray(p?.missing) ? p.missing.filter((s: any) => typeof s === "string") : []);
  for (const f of required) if (!out[f]) miss.add(f);
  out.missing = Array.from(miss);
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { photos } = await req.json();
    if (!Array.isArray(photos) || !photos.length) {
      return new Response(JSON.stringify({ error: "Envie pelo menos 1 foto em `photos`." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [{
      type: "text",
      text: `Analise as ${photos.length} fotos abaixo. Agrupe as que pertencem ao MESMO produto e extraia os campos. Retorne o JSON conforme instruído.`,
    }];
    photos.forEach((p: any, idx: number) => {
      if (!p?.base64 || !p?.mime_type) return;
      userContent.push({ type: "text", text: `Foto ${idx}:` });
      userContent.push({ type: "image_url", image_url: { url: `data:${p.mime_type};base64,${p.base64}` } });
    });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: `Gateway ${res.status}: ${errText.slice(0, 300)}` }), {
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
      if (!m) throw new Error("Resposta IA inválida");
      parsed = JSON.parse(m[0]);
    }
    const products = Array.isArray(parsed?.products) ? parsed.products.map(cleanProduct) : [];
    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("group-photos-into-products error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
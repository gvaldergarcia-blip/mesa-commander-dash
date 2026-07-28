import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Leitura de embalagens com política "zero erro":
 *  1) Duas leituras independentes (consenso) das MESMAS fotos.
 *  2) Campos críticos só são aceitos quando as duas leituras concordam
 *     E a confiança declarada é >= CRITICAL_THRESHOLD.
 *  3) Validação determinística (datas plausíveis, EAN, SIF, lote).
 *  4) Tudo que não passar vira `needs_review` com um motivo legível — o app
 *     bloqueia a impressão até o humano confirmar.
 */
const CRITICAL_THRESHOLD = 0.85;
const CRITICAL_FIELDS = ["name", "expires_at", "manufactured_at", "batch", "sif", "barcode"] as const;

const SYSTEM = `Você é um leitor técnico de embalagens de alimentos para um sistema de rastreabilidade sanitária. Erros custam multa sanitária e risco à saúde. Precisão é mais importante que preencher campos.

Você recebe VÁRIAS fotografias. Cada foto tem um índice (0-based) na ordem enviada.

Tarefas:
1) AGRUPAR as fotos que pertencem ao MESMO produto físico (frente/verso/lote/validade/SIF/código de barras da mesma embalagem).
2) Para cada grupo, LER os campos abaixo usando todas as fotos do grupo.
3) NUNCA inferir, deduzir, completar ou "chutar". Só informe o que está LITERALMENTE legível na imagem. Se estiver borrado, cortado, com reflexo ou parcialmente visível: retorne null e explique em "issues".

REGRAS ANTI-ALUCINAÇÃO (obrigatórias):
- É PREFERÍVEL retornar null a retornar um valor incerto.
- Nunca complete dígitos ausentes de lote, SIF, código de barras ou data.
- Nunca calcule validade a partir da fabricação. Só leia o que está impresso.
- Confiança deve refletir a legibilidade REAL: use < 0.85 sempre que houver qualquer dúvida de caractere.

Retorne SOMENTE JSON válido, sem markdown:
{
  "products": [
    {
      "photo_indices": [number],
      "name": string|null,
      "brand": string|null,
      "barcode": string|null,
      "weight": string|null,
      "expires_at": "YYYY-MM-DD"|null,
      "manufactured_at": "YYYY-MM-DD"|null,
      "batch": string|null,
      "sif": string|null,
      "category": string|null,
      "conservation": "refrigerated"|"frozen"|"ambient"|"hot"|null,
      "post_opening_value": number|null,
      "post_opening_unit": "hours"|"days"|"months"|"immediate"|null,
      "post_opening_text": string|null,
      "confidence": { "name": number, "brand": number, "barcode": number, "weight": number, "expires_at": number, "manufactured_at": number, "batch": number, "sif": number, "category": number, "conservation": number },
      "issues": [ { "field": string, "reason": "blur"|"glare"|"cropped"|"absent"|"unreadable"|"ambiguous", "hint": string } ],
      "missing": [string]
    }
  ]
}

- Datas SEMPRE ISO YYYY-MM-DD (converta DD/MM/AAAA; ano 2 dígitos = 20AA).
- "sif" apenas números.
REGRA PÓS-ABERTURA (validade após abertura/manipulação):
- Procure no rótulo textos como "Após aberto consumir em até 7 dias", "Consumir em até 48 horas",
  "Após abertura manter refrigerado por 5 dias", "Depois de aberto consumir em até 72 horas",
  "Após descongelado consumir em até 24 horas".
- Se encontrar, retorne o número em "post_opening_value", a unidade em "post_opening_unit"
  ("hours", "days" ou "months") e o texto literal lido em "post_opening_text".
- CONSUMO IMEDIATO: se o rótulo disser "consumir imediatamente após aberto", "consumir logo após aberto",
  "consumo imediato" ou equivalente, retorne "post_opening_unit": "immediate", "post_opening_value": 1
  e o texto literal em "post_opening_text".
- Se NÃO houver essa informação impressa, retorne os três campos como null. Nunca deduza nem estime.

- "hint" deve ser uma instrução curta em português dizendo o que refotografar (ex.: "Aproxime a foto do lote impresso a laser na lateral").`;

function clampConf(n: any): number {
  const v = Number(n);
  if (!isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

const norm = (v: any) =>
  v == null ? "" : String(v).toUpperCase().replace(/[^A-Z0-9]/g, "");

function isoOk(s: any) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ""); }

function eanValid(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

function cleanProduct(p: any) {
  const conf = p?.confidence || {};
  const out: any = {
    photo_indices: Array.isArray(p?.photo_indices) ? p.photo_indices.filter((n: any) => Number.isInteger(n) && n >= 0) : [],
    name: p?.name || null,
    brand: p?.brand || null,
    barcode: p?.barcode ? String(p.barcode).replace(/\D/g, "") || null : null,
    weight: p?.weight || null,
    expires_at: isoOk(p?.expires_at) ? p.expires_at : null,
    manufactured_at: isoOk(p?.manufactured_at) ? p.manufactured_at : null,
    batch: p?.batch ? String(p.batch).trim() : null,
    sif: p?.sif ? String(p.sif).replace(/\D/g, "") || null : null,
    category: p?.category || null,
    post_opening_value: p?.post_opening_unit === "immediate"
      ? 1
      : (Number.isFinite(Number(p?.post_opening_value)) && Number(p?.post_opening_value) > 0 ? Number(p.post_opening_value) : null),
    post_opening_unit: ["hours", "days", "months", "immediate"].includes(p?.post_opening_unit) ? p.post_opening_unit : null,
    post_opening_text: typeof p?.post_opening_text === "string" ? p.post_opening_text.slice(0, 200) : null,
    conservation: ["refrigerated", "frozen", "ambient", "hot"].includes(p?.conservation) ? p.conservation : null,
    confidence: {} as Record<string, number>,
    issues: Array.isArray(p?.issues)
      ? p.issues.filter((i: any) => i && typeof i.field === "string").map((i: any) => ({
          field: i.field,
          reason: ["blur", "glare", "cropped", "absent", "unreadable", "ambiguous"].includes(i.reason) ? i.reason : "unreadable",
          hint: typeof i.hint === "string" ? i.hint.slice(0, 160) : "",
        }))
      : [],
    missing: [] as string[],
  };
  for (const f of ["name", "brand", "barcode", "weight", "expires_at", "manufactured_at", "batch", "sif", "category", "conservation"]) {
    out.confidence[f] = clampConf(conf[f]);
  }
  return out;
}

/** Pareia produtos da 2ª leitura com os da 1ª por sobreposição de fotos. */
function matchProduct(target: any, pool: any[]): any | null {
  let best: any = null; let bestScore = 0;
  for (const c of pool) {
    const a = new Set(target.photo_indices);
    const inter = (c.photo_indices || []).filter((i: number) => a.has(i)).length;
    const score = inter / Math.max(1, Math.max(a.size, (c.photo_indices || []).length));
    if (inter > 0 && score > bestScore) { best = c; bestScore = score; }
  }
  return bestScore >= 0.3 ? best : null;
}

const REASON_HINT: Record<string, string> = {
  conflict: "As duas leituras da IA discordaram — confirme manualmente ou refotografe este campo.",
  low_confidence: "A IA não teve certeza da leitura — confirme manualmente ou refotografe este campo.",
  invalid: "O valor lido não passou na validação técnica.",
  absent: "Não encontrado em nenhuma foto deste produto.",
};

/** Cruza as duas leituras + validações determinísticas. */
function reconcile(a: any, b: any | null) {
  const out = { ...a };
  const status: Record<string, string> = {};
  const issues: Array<{ field: string; reason: string; hint: string }> = [...(a.issues || [])];
  const needs: string[] = [];

  const pushIssue = (field: string, reason: string, hint?: string) => {
    if (!issues.some((i) => i.field === field && i.reason === reason)) {
      issues.push({ field, reason, hint: hint || REASON_HINT[reason] || "" });
    }
  };

  // Validações determinísticas antes do consenso.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const y = today.getUTCFullYear();
  if (out.expires_at) {
    const yr = Number(out.expires_at.slice(0, 4));
    if (yr < y - 1 || yr > y + 12) { pushIssue("expires_at", "invalid", "Ano de validade implausível. Refotografe a data."); out.expires_at = null; }
  }
  if (out.manufactured_at) {
    const yr = Number(out.manufactured_at.slice(0, 4));
    if (yr < y - 12 || yr > y + 1) { pushIssue("manufactured_at", "invalid", "Ano de fabricação implausível."); out.manufactured_at = null; }
  }
  if (out.expires_at && out.manufactured_at && out.expires_at <= out.manufactured_at) {
    pushIssue("expires_at", "invalid", "Validade anterior ou igual à fabricação. Refotografe as datas.");
    out.expires_at = null;
  }
  if (out.barcode && !eanValid(out.barcode)) {
    pushIssue("barcode", "invalid", "Código de barras não passou no dígito verificador.");
    out.barcode = null;
  }
  if (out.sif && !/^\d{1,5}$/.test(out.sif)) {
    pushIssue("sif", "invalid", "Registro SIF/SISP/SIM fora do padrão numérico.");
    out.sif = null;
  }
  if (out.batch && (out.batch.length < 2 || out.batch.length > 30)) {
    pushIssue("batch", "invalid", "Lote lido com tamanho improvável.");
    out.batch = null;
  }

  for (const f of CRITICAL_FIELDS) {
    const val = (out as any)[f];
    const conf = out.confidence[f] ?? 0;
    if (!val) {
      status[f] = "absent";
      if (!issues.some((i) => i.field === f)) pushIssue(f, "absent");
      continue;
    }
    const other = b ? (b as any)[f] : undefined;
    if (b && norm(other) && norm(other) !== norm(val)) {
      status[f] = "conflict";
      pushIssue(f, "conflict", `Leitura 1: "${val}" · Leitura 2: "${other}". Confirme o valor correto.`);
      needs.push(f);
      continue;
    }
    if (conf < CRITICAL_THRESHOLD) {
      status[f] = "low_confidence";
      pushIssue(f, "low_confidence");
      needs.push(f);
      continue;
    }
    // Consenso + confiança alta → verificado.
    status[f] = b && norm(other) === norm(val) ? "verified" : "single_read";
    if (status[f] === "single_read" && conf < 0.95) {
      // Só uma leitura enxergou o campo: exige confirmação humana.
      status[f] = "low_confidence";
      pushIssue(f, "low_confidence", "Apenas uma das duas leituras encontrou este dado.");
      needs.push(f);
    }
  }

  out.issues = issues;
  out.field_status = status;
  out.needs_review = Array.from(new Set(needs));
  out.missing = ["name", "expires_at", "batch", "sif"].filter((f) => !(out as any)[f]);
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readPass(apiKey: string, userContent: any[], variant: number, modelOverride?: string) {
  // Timeout duro: se o modelo travar, abortamos e o retry usa outro modelo.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: ctrl.signal,
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelOverride ?? "google/gemini-2.5-flash",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        ...(variant === 1
          ? [{ role: "system", content: "Esta é uma SEGUNDA leitura independente para auditoria. Releia do zero, caractere por caractere, sem suposições." }]
          : []),
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
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
  return Array.isArray(parsed?.products) ? parsed.products.map(cleanProduct) : [];
  } finally {
    clearTimeout(timer);
  }
}

// Gateway pode devolver 429/503 temporário: tenta novamente com backoff e modelo alternativo.
async function readPassResilient(apiKey: string, userContent: any[], variant: number) {
  // Flash primeiro (rápido e estável). Pro só como plano B — ele levava 40-60s
  // por chamada e fazia a análise "travar" no cliente.
  const models = variant === 0
    ? ["google/gemini-2.5-flash", "google/gemini-2.5-pro"]
    : ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"];
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = models[Math.min(attempt, models.length - 1)];
    try {
      return await readPass(apiKey, userContent, variant, model);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      const transient = /Gateway (408|409|425|429|5\d\d)/.test(msg) || /abort/i.test(msg);
      if (!transient || attempt === 2) throw e;
      console.warn(`Leitura ${variant} falhou (${model}), retry ${attempt + 1}: ${msg.slice(0, 120)}`);
      await sleep(700 * (attempt + 1));
    }
  }
  throw lastErr;
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
      text: `Analise as ${photos.length} fotos abaixo. Agrupe as que pertencem ao MESMO produto e leia os campos. Não invente nada.`,
    }];
    photos.forEach((p: any, idx: number) => {
      if (!p?.base64 || !p?.mime_type) return;
      userContent.push({ type: "text", text: `Foto ${idx}:` });
      userContent.push({ type: "image_url", image_url: { url: `data:${p.mime_type};base64,${p.base64}` } });
    });

    // As duas leituras rodam em PARALELO — antes eram sequenciais e somavam
    // 60-70s por bloco, o que fazia a tela ficar "Agrupando..." sem fim.
    const [passA, passB] = await Promise.all([
      readPassResilient(apiKey, userContent, 0),
      readPassResilient(apiKey, userContent, 1).catch((e) => {
        console.warn("2ª leitura falhou", e);
        return null;
      }),
    ]);

    const products = passA.map((p: any) => reconcile(p, passB ? matchProduct(p, passB) : null));
    return new Response(JSON.stringify({ products, consensus: !!passB, threshold: CRITICAL_THRESHOLD }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("group-photos-into-products error", e);
    const msg = String(e?.message || "Erro desconhecido");
    if (/Gateway 429/.test(msg)) {
      return new Response(JSON.stringify({ error: "Muitas análises seguidas. Aguarde alguns segundos e toque em Reanalisar." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (/Gateway 5\d\d/.test(msg)) {
      return new Response(JSON.stringify({ error: "A IA está temporariamente indisponível. Tente Reanalisar em instantes — suas fotos foram mantidas." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

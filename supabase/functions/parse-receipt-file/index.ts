import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um extrator especialista em notas fiscais brasileiras (NF-e, DANFE), listas de fornecedor e pedidos de recebimento de restaurantes.

Retorne APENAS JSON válido no formato EXATO:
{
  "supplier": string|null,
  "reference": string|null,
  "items": [
    {
      "raw_name": string,
      "quantity": number,          // QUANTIDADE FÍSICA (número de peças/unidades/caixas). Sempre inteiro >= 1 quando a unidade for un/cx/peça. Pode ser decimal APENAS quando a venda é a granel (kg/g/l/ml) e não há contagem de peças.
      "quantity_raw": string,      // Texto EXATO da célula lida (ex.: "60,80", "1,202", "0,522"). Preserve vírgulas, pontos e casas decimais.
      "unit": "un"|"kg"|"g"|"l"|"ml"|"cx"|"peça",
      "weight": number|null,       // Peso/volume TOTAL recebido, quando existir na nota. Preserve TODAS as casas decimais (ex.: "9,840 KG" → 9.840).
      "weight_raw": string|null,   // Texto EXATO do campo peso (ex.: "9,840", "60,80"). Preserve vírgulas e casas decimais.
      "weight_unit": "kg"|"g"|"l"|"ml"|null
    }
  ]
}

REGRAS CRÍTICAS (leia com atenção — erros aqui quebram o sistema):

1. QUANTIDADE vs PESO — nunca confunda:
   - Em NF-e brasileira as colunas típicas são: "Qtd", "Un", "Vl Unit", "Vl Total". Existe também "Peso Líquido/Bruto".
   - Se a coluna "Un" for KG/G/L/ML → o valor de "Qtd" É o peso/volume. Nesse caso: quantity = esse número decimal, unit = a unidade correspondente, weight = mesmo número, weight_unit = mesma unidade.
   - Se a coluna "Un" for UN/CX/PC/PÇ/PEÇA/FD (fardo) → quantity é o NÚMERO DE PEÇAS (inteiro). Se a linha também informa um peso total separado (ex.: "10 UN — 9,840 KG" ou coluna "Peso"), preencha weight e weight_unit com esse peso; NÃO jogue o peso em quantity.
   - Nunca use o valor monetário (R$) como quantidade.

2. DECIMAIS BR — REGRA CRÍTICA (nunca perca casas decimais):
   - Vírgula é SEMPRE separador decimal em NF-e brasileira. NUNCA remova a vírgula.
   - "60,80" = 60.80 (NÃO 6080, NÃO 608).
   - "1,202" = 1.202 (NÃO 1202). Em NF-e, quantidades podem ter até 4 casas decimais.
   - "0,522" = 0.522 (NÃO 522).
   - "15,000" = 15.000 (preserve os 3 zeros como precisão — NÃO vire 15000).
   - Ponto pode ser separador de milhar APENAS quando o número tem exatamente 3 dígitos depois do ponto E o campo é claramente um valor grande (ex.: "10.500 UN" para caixas grandes). Quando em dúvida, trate ponto como decimal.
   - Preserve EXATAMENTE a quantidade de casas decimais do documento em "quantity_raw" e "weight_raw" (texto literal da célula, com vírgula).
   - Em "quantity" e "weight", retorne o número JSON com ponto decimal e a mesma precisão (ex.: 60.80, 1.202, 0.522).
   - Nunca use replace(",", "") ou lógica que descarte separadores.

3. NOME: use raw_name EXATAMENTE como aparece (mantenha acentos, códigos e siglas). Não normalize, não abrevie, não traduza.

4. UNIDADES — mapeamento:
   - "KG","QUILO","QUILOS" → "kg"
   - "G","GR","GRAMA","GRAMAS" → "g"
   - "L","LT","LITRO","LITROS" → "l"
   - "ML","MILILITRO" → "ml"
   - "CX","CAIXA" → "cx"
   - "UN","UND","UNID","UNIDADE","PC","PÇ","PEÇA","PECA","FD","PCT","PACOTE" → "un"

5. FORNECEDOR: extraia a razão social do EMITENTE (quem emitiu a nota), não do destinatário. Em listas simples, use o cabeçalho.

6. REFERÊNCIA: número da NF-e (ex.: "Nº 000.123.456") ou número do pedido.

7. IGNORE: totais, subtotais, impostos (ICMS, IPI, PIS, COFINS), frete, endereços, CNPJ, inscrição estadual, dados de transporte, observações fiscais.

8. NÃO INVENTE itens. Se estiver em dúvida sobre um valor, prefira null a chutar.

9. PESO/VOLUME NO NOME DO PRODUTO — REGRA CRÍTICA:
   Quando a unidade é UN/CX/PC/PÇ/PEÇA/FD/PCT e o nome do produto contém peso/volume por peça (ex.: "Óleo de Soja 900ml", "Molho de Tomate 340g", "Água Mineral 1,5L", "Leite Condensado 395g", "Refrigerante 2L"), EXTRAIA esse valor e preencha:
     - weight = número exato (ex.: 900, 340, 1.5, 395, 2)
     - weight_unit = unidade correspondente ("ml", "g", "l", "kg")
   Exemplo: "Óleo de Soja 900ml", UN 6 → { quantity: 6, unit: "un", weight: 900, weight_unit: "ml" }.
   Exemplo: "Molho de Tomate 340g", UN 12 → { quantity: 12, unit: "un", weight: 340, weight_unit: "g" }.
   Se o nome NÃO contém peso/volume (ex.: "Sal Refinado", "Alface Crespa"), deixe weight = null e weight_unit = null.

10. Responda SOMENTE o JSON, sem markdown, sem comentários, sem texto extra.`;

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

    const model = isPdf ? "google/gemini-2.5-pro" : "google/gemini-2.5-pro";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
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

    // Converte um valor (número JSON OU string bruta preservada) em number sem
    // perder casas decimais. Nunca faz replace destrutivo às cegas.
    const toNum = (v: any, raw?: any): { value: number | null; lowConfidence: boolean } => {
      // Preferência: usar a string bruta preservada quando disponível — a IA
      // pode ter arredondado o número JSON.
      const source = raw !== undefined && raw !== null && String(raw).trim() !== "" ? raw : v;
      if (source === null || source === undefined || source === "") return { value: null, lowConfidence: false };
      if (typeof source === "number") return { value: Number.isFinite(source) ? source : null, lowConfidence: false };
      const s = String(source).trim().replace(/\s+/g, "");
      const hasComma = s.includes(",");
      const hasDot = s.includes(".");
      let normalized = s;
      if (hasComma && hasDot) {
        // BR: ponto=milhar, vírgula=decimal. Remove pontos, troca vírgula por ponto.
        normalized = s.replace(/\./g, "").replace(",", ".");
      } else if (hasComma) {
        // Só vírgula → sempre decimal. NÃO remover.
        normalized = s.replace(",", ".");
      } else if (hasDot) {
        // Só ponto → decimal (não removemos, senão perdemos precisão).
        normalized = s;
      }
      const n = Number(normalized);
      if (!Number.isFinite(n)) return { value: null, lowConfidence: true };
      // Detecta possível perda de precisão: se v (número JSON) diferir muito
      // do valor derivado do raw, marca baixa confiança.
      let lowConfidence = false;
      if (raw && typeof v === "number") {
        // Se JSON veio como inteiro e raw tem casa decimal, perdemos precisão.
        const rawStr = String(raw);
        if (/[.,]\d+/.test(rawStr) && Number.isInteger(v)) lowConfidence = true;
      }
      return { value: n, lowConfidence };
    };
    const normUnit = (u: any): string => {
      const s = String(u || "").toLowerCase().trim();
      if (["kg","g","l","ml","cx"].includes(s)) return s;
      if (["un","und","unid","unidade","pc","pç","peça","peca","fd","pct","pacote","peça"].includes(s)) return "un";
      return "un";
    };
    const normWUnit = (u: any): string | null => {
      const s = String(u || "").toLowerCase().trim();
      return ["kg","g","l","ml"].includes(s) ? s : null;
    };

    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    // Fallback: extrai peso/volume do nome quando IA não preencheu (ex.: "Óleo de Soja 900ml")
    const extractWeightFromName = (name: string): { weight: number; weight_unit: string } | null => {
      const s = String(name || "");
      // captura: número (com , ou .) + unidade (kg/g/l/ml), possivelmente colado
      const re = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml)\b/i;
      const m = s.match(re);
      if (!m) return null;
      const n = Number(m[1].replace(",", "."));
      if (!Number.isFinite(n)) return null;
      return { weight: n, weight_unit: m[2].toLowerCase() };
    };
    const clean = items
      .map((it: any) => {
        const unit = normUnit(it.unit);
        const isBulkUnit = ["kg","g","l","ml"].includes(unit);
        const qParsed = toNum(it.quantity, it.quantity_raw);
        const wParsed = toNum(it.weight, it.weight_raw);
        let quantity = qParsed.value;
        let weight = wParsed.value;
        let weight_unit = normWUnit(it.weight_unit);
        let low_confidence = qParsed.lowConfidence || wParsed.lowConfidence;

        if (isBulkUnit) {
          // Venda a granel: quantity é o peso; espelha em weight. NUNCA arredonda.
          if (quantity === null && weight !== null) quantity = weight;
          if (weight === null && quantity !== null) { weight = quantity; weight_unit = unit as any; }
          if (!weight_unit) weight_unit = unit as any;
        } else {
          // Peças: quantity precisa ser inteiro >= 1. Se veio decimal (ex.: 1.5 un),
          // marca baixa confiança em vez de arredondar às cegas.
          if (quantity !== null && !Number.isInteger(quantity)) low_confidence = true;
          quantity = Math.max(1, Math.round(quantity ?? 1));
          // Se IA não trouxe peso/volume, tenta extrair do nome (ex.: "Óleo 900ml").
          if (weight === null) {
            const fromName = extractWeightFromName(it.raw_name);
            if (fromName) {
              weight = fromName.weight;
              weight_unit = fromName.weight_unit;
            }
          }
        }

        return {
          raw_name: String(it.raw_name || "").trim(),
          quantity: quantity ?? 1,
          quantity_raw: it.quantity_raw ? String(it.quantity_raw) : null,
          unit,
          weight,
          weight_raw: it.weight_raw ? String(it.weight_raw) : null,
          weight_unit,
          low_confidence,
        };
      })
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
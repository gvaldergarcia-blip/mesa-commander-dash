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
      "unit": "un"|"kg"|"g"|"l"|"ml"|"cx"|"peça",
      "weight": number|null,       // Peso/volume TOTAL recebido, quando existir na nota (ex.: "9,840 KG"). Preserve o valor exatamente como está.
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

2. DECIMAIS BR: interprete vírgula como separador decimal ("9,840" = 9.84). Ponto pode ser separador de milhar ("1.200" = 1200) — use o contexto da coluna para decidir.

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

9. Responda SOMENTE o JSON, sem markdown, sem comentários, sem texto extra.`;

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

    const toNum = (v: any): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const s = String(v).trim().replace(/\./g, "").replace(",", ".");
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
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
    const clean = items
      .map((it: any) => {
        const unit = normUnit(it.unit);
        const isBulkUnit = ["kg","g","l","ml"].includes(unit);
        let quantity = toNum(it.quantity);
        let weight = toNum(it.weight);
        let weight_unit = normWUnit(it.weight_unit);

        if (isBulkUnit) {
          // Venda a granel: quantity é o peso; espelha em weight.
          if (quantity === null && weight !== null) quantity = weight;
          if (weight === null && quantity !== null) { weight = quantity; weight_unit = unit; }
          if (!weight_unit) weight_unit = unit as any;
        } else {
          // Peças: quantity precisa ser inteiro >= 1.
          quantity = Math.max(1, Math.round(quantity ?? 1));
        }

        return {
          raw_name: String(it.raw_name || "").trim(),
          quantity: quantity ?? 1,
          unit,
          weight,
          weight_unit,
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
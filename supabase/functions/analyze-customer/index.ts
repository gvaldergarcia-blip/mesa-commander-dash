import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── SECURITY FLAGS ──
const REQUIRE_JWT = (Deno.env.get("REQUIRE_JWT_ANALYZE_CUSTOMER") ?? "true") === "true";

// ── CORS ──
const ALLOWED_ORIGINS = [
  "https://mesaclik.com.br",
  "https://www.mesaclik.com.br",
  "https://app.mesaclik.com.br",
  "https://painel.mesaclik.com.br",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
];
const PREVIEW_ORIGIN_RE = /^https:\/\/.*\.lovable\.app$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function authenticateRequest(req: Request, corsHeaders: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    if (REQUIRE_JWT) {
      return { userId: null, error: new Response(JSON.stringify({ error: "Autenticação necessária" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
    }
    return { userId: null, error: null };
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { userId: null, error: new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { userId: data.user.id, error: null };
}

async function validateMembership(userId: string, restaurantId: string, corsHeaders: Record<string, string>) {
  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: membership } = await supabaseAdmin.from("restaurant_members").select("restaurant_id").eq("user_id", userId).eq("restaurant_id", restaurantId).maybeSingle();
  if (!membership) {
    const { data: adminRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Acesso negado ao restaurante" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await authenticateRequest(req, corsHeaders);
    if (auth.error) return auth.error;

    const { customer_id, restaurant_id, customer_data, history_data, metrics } = await req.json();

    if (auth.userId && restaurant_id) {
      const ownershipError = await validateMembership(auth.userId, restaurant_id, corsHeaders);
      if (ownershipError) return ownershipError;
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    if (!customer_data || !metrics) {
      return new Response(JSON.stringify({ error: 'Dados insuficientes para análise', analysis: null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const customerContext = `
DADOS DO CLIENTE:
- Nome: ${customer_data.name || 'Não informado'}
- Status VIP: ${customer_data.vip_status ? 'Sim' : 'Não'}
- Opt-in Marketing: ${customer_data.marketing_opt_in ? 'Sim' : 'Não'}
- Cliente desde: ${customer_data.created_at || 'N/A'}

MÉTRICAS:
- Total de visitas: ${metrics.total_visits || 0}
- Filas concluídas: ${metrics.queue_completed || 0}
- Reservas concluídas: ${metrics.reservations_completed || 0}
- Cancelamentos: ${metrics.canceled_count || 0}
- Não comparecimentos: ${metrics.no_show_count || 0}
- Taxa de comparecimento: ${metrics.show_rate || 100}%
- Tamanho médio de grupo: ${metrics.avg_party_size || 0} pessoas
- Horário preferido: ${metrics.preferred_time || 'N/A'}
- Canal preferido: ${metrics.preferred_channel || 'N/A'}
- Dias desde última visita: ${customer_data.days_since_last_visit || 0}
- Visitas nos últimos 30 dias: ${metrics.visits_last_30d ?? 'N/A'}
- Visitas nos últimos 90 dias: ${metrics.visits_last_90d ?? 'N/A'}
- Frequência média (dias entre visitas): ${metrics.avg_days_between_visits ?? 'N/A'}
- Primeira visita: ${metrics.first_visit_date ?? 'N/A'}

HISTÓRICO:
- Filas no histórico: ${history_data?.queue_count || 0}
- Reservas no histórico: ${history_data?.reservation_count || 0}
- Promoções enviadas: ${metrics.promotions_sent || 0}
`;

    const systemPrompt = `Você é a IA de análise estratégica de clientes do MesaClik, um SaaS premium de CRM para restaurantes.

REGRAS OBRIGATÓRIAS:
- Use APENAS os dados fornecidos, nunca invente ou simule
- Se dados forem insuficientes, indique claramente
- Tom profissional, direto, executivo (estilo SaaS enterprise)
- Textos curtos e objetivos
- IDIOMA: 100% em Português do Brasil

REGRA CRÍTICA — SUGESTÃO DE PROMOÇÃO:
Só sugira promoção quando risco de perda for MÉDIO ou ALTO, queda de frequência, cancelamentos recorrentes, ou longo período sem visita (>21 dias para frequentes).
Se o cliente for saudável: defina tipo_acao como "nao_agir" ou "acompanhar".

Com base nos dados do cliente, gere uma análise JSON com os seguintes campos:

{
  "resumo": "1-2 frases executivas sobre o perfil geral",
  "perfil_comportamento": "Descrição do padrão de visitas, preferências e hábitos",
  "risco_perda": {
    "nivel": "baixo|medio|alto",
    "justificativa": "Explicação breve"
  },
  "sensibilidade_promocao": {
    "nivel": "baixa|media|alta",
    "justificativa": "Explicação breve"
  },
  "retencao_30d": {
    "nivel": "baixa|media|alta",
    "justificativa": "Explicação breve"
  },
  "sugestao_acao": {
    "tipo": "enviar_promocao|fidelizar|recuperar|nao_agir|acompanhar",
    "descricao": "Ação recomendada",
    "momento_ideal": "Dia/horário sugerido ou null"
  },
  "score_rfm": {
    "recencia": <1-5>,
    "frequencia": <1-5>,
    "valor": <1-5>,
    "score_composto": <0-100>,
    "explicacao": "Frase curta explicando o score"
  },
  "segmento": {
    "id": "campeao|fiel|promissor|novo|em_risco|inativo|perdido",
    "label": "⭐ VIP|💚 Fiel|🚀 Promissor|🆕 Novo|⚠️ Em Risco|😴 Inativo|❌ Perdido",
    "cor": "dourado|verde|roxo|azul|laranja|cinza|vermelho",
    "acao_sugerida": "Ação clara para esse segmento"
  },
  "probabilidade_retorno_30d": {
    "score": <0-100>,
    "fatores_positivos": ["fator1", "fator2"],
    "fatores_negativos": ["fator1"],
    "explicacao": "Frase sobre a probabilidade"
  },
  "ltv_estimado": {
    "valor_mensal": <number>,
    "valor_anual": <number>,
    "classificacao": "alto|medio|baixo",
    "explicacao": "Como foi calculado"
  },
  "tendencia": "crescendo|estavel|diminuindo",
  "metricas_calculadas": {
    "taxa_cancelamento": <0-100>,
    "frequencia_media_dias": <number ou null>,
    "tipo_preferido": "fila|reserva|ambos"
  }
}

CRITÉRIOS PARA SCORE RFM (escala 1-5):

R (Recência):
  5 = veio há <14 dias
  4 = 15-30 dias
  3 = 31-60 dias
  2 = 61-90 dias
  1 = >90 dias

F (Frequência - visitas últimos 90 dias):
  5 = 8+ visitas
  4 = 5-7 visitas
  3 = 3-4 visitas
  2 = 2 visitas
  1 = 1 visita

M (Valor - proxy: total_visitas × tamanho_medio_grupo):
  5 = volume muito alto
  4 = volume alto
  3 = volume médio
  2 = volume baixo
  1 = volume mínimo

SCORE COMPOSTO: (R*0.4 + F*0.4 + M*0.2) normalizado 0-100

SEGMENTAÇÃO:
- CAMPEÃO: score_rfm >= 80
- FIEL: score_rfm 60-79 + total_visitas >= 5
- PROMISSOR: score_rfm 50-69 + tendencia crescendo
- NOVO: total_visitas <= 2 + cliente há <=30 dias
- EM RISCO: score_rfm 40-59 + tendencia diminuindo
- INATIVO: dias_desde_ultima_visita 45-90
- PERDIDO: dias_desde_ultima_visita > 90

PROBABILIDADE DE RETORNO (0-100):
Positivos: frequência alta (+40), recente <14d (+30), tendência crescendo (+15), reserva (+10), 3+ visitas (+5)
Negativos: 60+ dias sem visita (-30), tendência diminuindo (-20), cancelamento >30% (-15), 1 visita (-10)

LTV ESTIMADO:
ltv_mensal = (visitas_por_mes × tamanho_medio_grupo × R$45)
ltv_anual = ltv_mensal × 12
Se dados insuficientes, use estimativas conservadoras.

Responda APENAS com o JSON, sem explicações adicionais.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: customerContext }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analyze-customer] AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione mais créditos.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) throw new Error('Resposta vazia da IA');

    console.log('[analyze-customer] AI raw response:', content.substring(0, 200));

    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (_parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Não foi possível parsear a resposta da IA');
      }
    }

    console.log('[analyze-customer] Analysis generated successfully');

    return new Response(JSON.stringify({ analysis }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const corsH = getCorsHeaders(req);
    console.error('[analyze-customer] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }
});

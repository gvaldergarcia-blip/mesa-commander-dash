import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── SECURITY FLAGS ──
const REQUIRE_JWT = (Deno.env.get("REQUIRE_JWT_ANALYZE_CUSTOMER") ?? "true") === "true";

// ── CORS (restricted allowlist) ──
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
    "Vary": "Origin",
  };
}

// ── Auth helper ──
async function authenticateRequest(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<{ userId: string | null; error: Response | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    if (REQUIRE_JWT) {
      console.warn("[analyze-customer] Missing JWT — blocked");
      return {
        userId: null,
        error: new Response(
          JSON.stringify({ error: "Autenticação necessária" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        ),
      };
    }
    console.warn("[analyze-customer] Missing JWT — allowed (compat mode)");
    return { userId: null, error: null };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    console.warn("[analyze-customer] Invalid JWT:", error?.message);
    return {
      userId: null,
      error: new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { userId: data.user.id, error: null };
}

// ── Ownership validation ──
async function validateMembership(
  userId: string,
  restaurantId: string,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: membership } = await supabaseAdmin
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!membership) {
    // Check if admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      console.warn(`[analyze-customer] User ${userId} not member of restaurant ${restaurantId}`);
      return new Response(
        JSON.stringify({ error: "Acesso negado ao restaurante" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return null; // Access granted
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── AUTH ──
    const auth = await authenticateRequest(req, corsHeaders);
    if (auth.error) return auth.error;

    const { customer_id, restaurant_id, customer_data, history_data, metrics } = await req.json();

    console.log('[analyze-customer] Request:', { customer_id, restaurant_id, userId: auth.userId });

    // ── OWNERSHIP CHECK ──
    if (auth.userId && restaurant_id) {
      const ownershipError = await validateMembership(auth.userId, restaurant_id, corsHeaders);
      if (ownershipError) return ownershipError;
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!customer_data || !metrics) {
      return new Response(
        JSON.stringify({ error: 'Dados insuficientes para análise', analysis: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

HISTÓRICO:
- Filas no histórico: ${history_data?.queue_count || 0}
- Reservas no histórico: ${history_data?.reservation_count || 0}
- Promoções enviadas: ${metrics.promotions_sent || 0}
`;

    const systemPrompt = `Você é a IA de análise de clientes do MesaClik, um sistema premium de gestão para restaurantes.

REGRAS OBRIGATÓRIAS:
- Use APENAS os dados fornecidos, nunca invente ou simule
- Se dados forem insuficientes, indique claramente
- Mantenha tom profissional, direto e executivo (estilo SaaS enterprise)
- Textos curtos e objetivos, sem enrolação
- Foque em ajudar o restaurante a tomar decisões melhores
- IDIOMA: 100% em Português do Brasil

REGRA CRÍTICA — SUGESTÃO DE PROMOÇÃO:
A IA NÃO DEVE sugerir promoção por padrão.
Só sugira promoção quando:
- Risco de perda for MÉDIO ou ALTO
- Houve queda de frequência recente
- Cancelamentos ou não comparecimentos recorrentes
- Longo período sem visita (>21 dias para clientes frequentes)

Se o cliente for saudável (visitas regulares, bom comparecimento, engajamento consistente):
- NÃO sugira promoção
- Defina tipo_acao como "nao_agir" ou "acompanhar"
- Explique que nenhuma ação promocional é necessária

Com base nos dados do cliente, gere uma análise estruturada em JSON com os seguintes campos:

{
  "resumo": "1-2 frases executivas sobre o perfil geral do cliente",
  "perfil_comportamento": "Descrição do padrão de visitas, preferências, horários, tipo de grupo e hábitos identificados",
  "risco_perda": {
    "nivel": "baixo|medio|alto",
    "justificativa": "Explicação breve do porquê"
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
    "descricao": "Ação específica recomendada OU mensagem explícita de que nenhuma ação é necessária",
    "momento_ideal": "Dia/horário sugerido se aplicável, ou null"
  }
}

CRITÉRIOS DE CLASSIFICAÇÃO:

RISCO DE PERDA:
- Baixo: Visita regular (últimos 15 dias), taxa comparecimento >80%, padrão consistente
- Médio: 16-30 dias sem visita OU queda de frequência OU alguns cancelamentos
- Alto: >30 dias sem visita OU muitos cancelamentos/não comparecimentos

SENSIBILIDADE A PROMOÇÕES:
- Alta: Histórico de retorno após promoções, responde bem a incentivos
- Média: Responde ocasionalmente, comportamento misto
- Baixa: Não demonstra influência por promoções, prefere experiência

RETENÇÃO (30 DIAS):
- Alta: Padrão consistente, última visita recente (<10 dias), engajamento contínuo
- Média: Padrão irregular mas ainda engajado, 10-21 dias sem visita
- Baixa: Longo período sem visita (>21 dias), histórico negativo

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
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Adicione mais créditos.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('[analyze-customer] AI raw response:', content.substring(0, 200));

    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[analyze-customer] Parse error:', parseError);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Não foi possível parsear a resposta da IA');
      }
    }

    console.log('[analyze-customer] Analysis generated successfully');

    return new Response(
      JSON.stringify({ analysis }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const corsH = getCorsHeaders(req);
    console.error('[analyze-customer] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );
  }
});

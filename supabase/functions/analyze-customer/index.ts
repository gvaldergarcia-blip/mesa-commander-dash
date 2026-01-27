import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { customer_id, restaurant_id, customer_data, history_data, metrics } = await req.json();

    console.log('[analyze-customer] Request:', { customer_id, restaurant_id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Verificar dados mínimos
    if (!customer_data || !metrics) {
      return new Response(
        JSON.stringify({ 
          error: 'Dados insuficientes para análise',
          analysis: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar contexto para a IA
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
- No-shows: ${metrics.no_show_count || 0}
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
- Mantenha tom profissional, direto e executivo
- Textos curtos e objetivos, sem enrolação
- Foque em ajudar o restaurante a tomar decisões

Com base nos dados do cliente, gere uma análise estruturada em JSON com os seguintes campos:

{
  "resumo": "1-2 frases executivas sobre o perfil geral do cliente",
  "perfil_comportamento": "Descrição do padrão de visitas, preferências e hábitos",
  "risco_churn": {
    "nivel": "baixo|medio|alto",
    "justificativa": "Explicação breve do porquê"
  },
  "sensibilidade_promocao": {
    "nivel": "baixa|media|alta",
    "justificativa": "Explicação breve"
  },
  "probabilidade_retorno": {
    "nivel": "baixa|media|alta",
    "dias": 30,
    "justificativa": "Explicação breve"
  },
  "sugestao_acao": {
    "tipo": "enviar_promocao|fidelizar|recuperar|nao_agir|acompanhar",
    "descricao": "Ação específica recomendada",
    "momento_ideal": "Dia/horário sugerido se aplicável"
  }
}

CRITÉRIOS DE CLASSIFICAÇÃO:

RISCO DE CHURN:
- Baixo: Visita regular (últimos 15 dias), taxa comparecimento >80%
- Médio: 16-45 dias sem visita OU queda de frequência
- Alto: >45 dias sem visita OU muitos cancelamentos/no-shows

SENSIBILIDADE A PROMOÇÕES:
- Alta: Histórico de retorno após promoções, responde bem
- Média: Responde ocasionalmente
- Baixa: Não demonstra influência por promoções

PROBABILIDADE DE RETORNO:
- Alta: Padrão consistente, última visita recente
- Média: Padrão irregular mas ainda engajado
- Baixa: Longo período sem visita, histórico negativo

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

    // Tentar parsear o JSON da resposta
    let analysis;
    try {
      // Remover possíveis backticks de markdown
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[analyze-customer] Parse error:', parseError);
      // Tentar extrair JSON de dentro do texto
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
    console.error('[analyze-customer] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

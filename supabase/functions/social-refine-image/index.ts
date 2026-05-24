import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(apiKey: string, payload: any) {
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SRK);
    const body = await req.json().catch(() => ({}));
    const suggestionId = String(body.suggestionId || "").slice(0, 36);
    const assetId = String(body.assetId || "").slice(0, 36);
    const instruction = String(body.instruction || "").trim().slice(0, 2000);
    const forcedAction = body.action as ("image" | "caption" | "both" | "chat" | null) | undefined;

    if ((!suggestionId && !assetId) || !instruction) {
      return json({ error: "suggestionId ou assetId e instruction são obrigatórios" }, 400);
    }

    let ownerId: string | null = null;
    let restaurantId: string | null = null;
    let currentCaption = "";
    let currentImageUrl = "";
    let currentVersionNumber = 1;
    let currentSuggestionId: string | null = null;
    let ctx: any = {};
    let restMeta: any = {};

    if (suggestionId) {
      const { data: suggestion, error: sErr } = await admin
        .from("social_post_suggestions")
        .select("id, restaurant_id, current_version_id, copy_text, context_data, restaurants:restaurant_id(owner_id, name)")
        .eq("id", suggestionId)
        .maybeSingle();
      if (sErr) { console.error("suggestion select err:", sErr); return json({ error: "DB error: " + sErr.message }, 500); }
      if (!suggestion) return json({ error: "Suggestion not found" }, 404);
      ownerId = (suggestion as any).restaurants?.owner_id ?? null;
      restaurantId = suggestion.restaurant_id;
      currentCaption = suggestion.copy_text || "";
      currentSuggestionId = suggestion.id;
      ctx = (suggestion as any).context_data || {};
      restMeta = (suggestion as any).restaurants || {};
      const { data: cv } = await admin
        .from("social_post_versions")
        .select("image_url, version_number")
        .eq("id", suggestion.current_version_id)
        .maybeSingle();
      if (!cv?.image_url) return json({ error: "No current version" }, 404);
      currentImageUrl = cv.image_url;
      currentVersionNumber = cv.version_number || 1;
    } else {
      const { data: asset, error: aErr } = await admin
        .from("promotions_assets")
        .select("id, restaurant_id, image_url, caption_text")
        .eq("id", assetId)
        .maybeSingle();
      if (aErr) { console.error("asset select err:", aErr); return json({ error: "DB error: " + aErr.message }, 500); }
      if (!asset) return json({ error: "Asset not found" }, 404);
      restaurantId = asset.restaurant_id;
      currentCaption = asset.caption_text || "";
      currentImageUrl = asset.image_url || "";
      const { data: rest } = await admin
        .from("restaurants")
        .select("owner_id, name, cuisine")
        .eq("id", restaurantId)
        .maybeSingle();
      ownerId = rest?.owner_id ?? null;
      restMeta = rest ? { ...rest, cuisine_type: (rest as any).cuisine } : {};
      if (!currentImageUrl) return json({ error: "No current image" }, 404);
    }

    if (ownerId !== user.id) {
      const { data: isMember } = await admin.rpc("is_member_or_admin", {
        _user_id: user.id,
        _restaurant_id: restaurantId,
      });
      if (!isMember) {
        const { data: isAdm } = await admin.rpc("is_admin", { user_id: user.id });
        if (!isAdm) return json({ error: "Forbidden" }, 403);
      }
    }

    // Save user message
    if (currentSuggestionId) {
      await admin.from("social_post_chat_messages").insert({
        suggestion_id: currentSuggestionId,
        role: "user",
        content: instruction,
      });
    }

    // Load full chat history (all of it, capped 40)
    let history: { role: string; content: string }[] = [];
    if (currentSuggestionId) {
      const { data: hist } = await admin
        .from("social_post_chat_messages")
        .select("role, content, created_at")
        .eq("suggestion_id", currentSuggestionId)
        .order("created_at", { ascending: true })
        .limit(40);
      history = (hist || []).map((m: any) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }));
    }

    const dishName = (ctx?.dish_name || ctx?.dish?.name || "").toString();
    const headline = (ctx?.headline || ctx?.theme_headline || "").toString();
    const theme = (ctx?.theme || ctx?.theme_name || "").toString();
    const restName = (restMeta?.name || "").toString();
    const cuisine = (restMeta?.cuisine_type || "").toString();

    const systemPrompt = `Você é o Editor IA do MesaClik — um assistente de marketing especialista em Instagram para restaurantes brasileiros. Você está conversando com o dono do restaurante para ajustar um post (1:1) que ele vai publicar.

CONTEXTO DO POST ATUAL:
- Restaurante: ${restName}${cuisine ? ` (${cuisine})` : ""}
${dishName ? `- Prato em destaque: ${dishName}` : ""}
${theme ? `- Tema: ${theme}` : ""}
${headline ? `- Headline na imagem: "${headline}"` : ""}
- Legenda atual: """${currentCaption || "(vazia)"}"""

VOCÊ TEM 3 FERRAMENTAS:
1. edit_image — quando o dono pedir QUALQUER mudança visual (cor, fundo, iluminação, composição, texto na imagem, adicionar/remover elementos visuais).
2. rewrite_caption — quando o dono pedir mudança no TEXTO da legenda do post (encurtar, mudar tom, adicionar CTA, hashtags).
3. (sem ferramenta) — quando ele só fizer pergunta, pedir opinião, conselho de marketing, dúvida sobre horário/estratégia. Aí você responde em texto natural, com markdown, curto e direto.

REGRAS:
- Decida sozinho qual ferramenta usar (ou nenhuma) com base no pedido. Se o pedido envolver imagem E legenda, chame as duas ferramentas.
- Use o histórico completo da conversa para entender o contexto acumulado. Se o dono já pediu "fundo escuro" antes e agora diz "agora mais quente", aplique AMBOS.
- Para edit_image: descreva a edição em português, sendo específico, mantendo o prato e a composição base, a menos que ele peça pra trocar.
- Para rewrite_caption: a nova legenda DEVE manter o estilo brasileiro, ter emoji se fizer sentido, hashtags relevantes no fim, e seguir o pedido do dono. Retorne só o texto da legenda.
- Quando responder em texto (sem ferramenta), seja simpático, use markdown, dê dicas práticas. Você pode comentar a imagem porque você a está vendo.
- NUNCA invente dados do restaurante. Use só o que está no contexto acima.
- Português do Brasil sempre.`;

    // Build messages — last user message includes the current image so the AI can SEE it
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content: [
          { type: "text", text: `Imagem atual do post (v${currentVersionNumber}):` },
          { type: "image_url", image_url: { url: currentImageUrl } },
          { type: "text", text: instruction },
        ],
      },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "edit_image",
          description: "Edita a imagem atual do post aplicando a mudança visual pedida pelo dono. Use sempre que o pedido envolver qualquer aspecto visual.",
          parameters: {
            type: "object",
            properties: {
              edit_description: {
                type: "string",
                description: "Descrição clara em português do que mudar na imagem, considerando todo o histórico de ajustes da conversa. Seja específico mas conservador (não troque o prato a não ser que peçam).",
              },
            },
            required: ["edit_description"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "rewrite_caption",
          description: "Reescreve a legenda do post conforme pedido. Use sempre que o pedido envolver mudar o texto/legenda.",
          parameters: {
            type: "object",
            properties: {
              new_caption: {
                type: "string",
                description: "A nova legenda completa (texto + emoji + hashtags). Retorne pronta pra publicar.",
              },
            },
            required: ["new_caption"],
            additionalProperties: false,
          },
        },
      },
    ];

    // Tool choice: if forcedAction is set, force it; else let AI decide
    let toolChoice: any = "auto";
    if (forcedAction === "image") toolChoice = { type: "function", function: { name: "edit_image" } };
    else if (forcedAction === "caption") toolChoice = { type: "function", function: { name: "rewrite_caption" } };
    else if (forcedAction === "chat") toolChoice = "none";

    const aiResp = await callAI(LOVABLE_API_KEY, {
      model: "google/gemini-3-flash-preview",
      messages,
      tools,
      tool_choice: toolChoice,
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Limite de requisições. Tente em alguns segundos." }, 429);
      if (aiResp.status === 402) return json({ error: "Créditos de IA insuficientes." }, 402);
      const errTxt = await aiResp.text();
      console.error("AI planner error:", aiResp.status, errTxt);
      return json({ error: "Falha ao processar pedido" }, 500);
    }

    const aiJson = await aiResp.json();
    const choice = aiJson.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls || [];
    let assistantText = String(choice?.content || "").trim();

    let newVersion: any = null;
    let newCaption: string | null = null;
    const result: Record<string, unknown> = { success: true };

    // Execute tool calls
    for (const tc of toolCalls) {
      const fname = tc.function?.name;
      let args: any = {};
      try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}

      if (fname === "edit_image") {
        const editDesc = String(args.edit_description || instruction);
        const editPrompt = [
          `Você está editando uma peça de Instagram (1:1) de um restaurante brasileiro.`,
          restName ? `Restaurante: ${restName}${cuisine ? ` (${cuisine})` : ""}.` : "",
          dishName ? `Prato em destaque: ${dishName}.` : "",
          headline ? `Headline JÁ EXISTENTE na imagem: "${headline}". Mantenha esse texto exatamente igual, no mesmo lugar e estilo, a menos que o pedido peça para mudá-lo.` : "",
          ``,
          `EDIÇÃO PEDIDA:`,
          editDesc,
          ``,
          `REGRAS:`,
          `- Mantenha o prato e a composição base, a não ser que o pedido peça mudança explícita. NÃO invente elementos novos na mesa sem necessidade.`,
          `- Estilo: foto realista, food photography profissional, premium mas natural. NUNCA cartoon/3D/ilustração. NUNCA visual plástico, exagerado, surreal ou com cara óbvia de IA.`,
          `- NUNCA inclua pessoas, rostos, mãos, braços, corpos, multidão, clientes comendo, interior de restaurante, mesas cheias de gente, luzinhas/pisca-pisca de fundo, lâmpadas — a menos que o dono peça explicitamente. É um still life de comida.`,
          `- Fundo limpo, minimalista, desfocado (madeira escura, pedra fosca ou tecido). Use no máximo 1 prop discreto (garfo OU guardanapo) e só se realmente ajudar. Nada de garrafas, copos, pratos extras, enfeites, cardápio, flores, velas ou objetos aleatórios na mesa.`,
          `- Mesa e superfície impecavelmente limpas: sem sujeira, migalhas, ervas espalhadas, respingos, manchas, marcas de copo, óleo escorrendo ou bagunça visual.`,
          `- Preserve textura real da comida: sem brilho artificial, sem steam fake, sem ingredientes duplicados, sem deformações, sem excesso de nitidez, sem HDR exagerado.`,
          `- Quadrado 1:1, alta resolução. Sem marca d'água, sem moldura.`,
          `- Texto em português do Brasil, sem erros de ortografia, sem letras tortas.`,
        ].filter(Boolean).join("\n");

        const imgResp = await callAI(LOVABLE_API_KEY, {
          model: "google/gemini-3-pro-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: editPrompt },
                { type: "image_url", image_url: { url: currentImageUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
        });

        if (!imgResp.ok) {
          if (imgResp.status === 429) return json({ error: "Limite de requisições. Tente em alguns segundos." }, 429);
          if (imgResp.status === 402) return json({ error: "Créditos de IA insuficientes." }, 402);
          const t = await imgResp.text();
          console.error("Image edit error:", imgResp.status, t);
          return json({ error: "Falha ao editar imagem" }, 500);
        }
        const imgJson = await imgResp.json();
        const base64 = imgJson.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!base64) return json({ error: "Nenhuma imagem gerada" }, 500);

        const b64data = base64.replace(/^data:image\/\w+;base64,/, "");
        const bytes = Uint8Array.from(atob(b64data), (c) => c.charCodeAt(0));
        const fileName = `${restaurantId}/${crypto.randomUUID()}.png`;
        const { error: upErr } = await admin.storage.from("promotion-images").upload(fileName, bytes, { contentType: "image/png" });
        if (upErr) return json({ error: "Falha ao salvar imagem" }, 500);
        const { data: pub } = admin.storage.from("promotion-images").getPublicUrl(fileName);

        if (currentSuggestionId) {
          const { data: nv, error: insErr } = await admin
            .from("social_post_versions")
            .insert({
              suggestion_id: currentSuggestionId,
              version_number: currentVersionNumber + 1,
              image_url: pub.publicUrl,
              prompt_used: editPrompt,
              edit_instruction: instruction,
            })
            .select("*")
            .single();
          if (insErr) return json({ error: "Erro ao salvar versão" }, 500);
          await admin.from("social_post_suggestions").update({ current_version_id: nv.id }).eq("id", currentSuggestionId);
          newVersion = nv;
          result.version = nv;
        } else {
          await admin.from("promotions_assets").update({ image_url: pub.publicUrl }).eq("id", assetId);
          result.image_url = pub.publicUrl;
        }
      } else if (fname === "rewrite_caption") {
        newCaption = String(args.new_caption || "").trim();
        if (newCaption) {
          if (currentSuggestionId) {
            await admin.from("social_post_suggestions").update({ copy_text: newCaption }).eq("id", currentSuggestionId);
          } else {
            await admin.from("promotions_assets").update({ caption_text: newCaption }).eq("id", assetId);
          }
          result.copy_text = newCaption;
        }
      }
    }

    // Build final message: AI's text + tool summaries
    if (!assistantText) {
      const parts: string[] = [];
      if (newVersion) parts.push(`✨ Pronto — gerei a **v${newVersion.version_number}** com o ajuste pedido. Dá uma olhada e me diz se quer refinar mais.`);
      else if (result.image_url) parts.push("✨ Atualizei a imagem com o ajuste pedido.");
      if (newCaption) parts.push(`📝 Atualizei a legenda:\n\n${newCaption}`);
      assistantText = parts.join("\n\n") || "Feito.";
    } else if (newVersion || newCaption || result.image_url) {
      const tags: string[] = [];
      if (newVersion) tags.push(`✨ v${newVersion.version_number} gerada`);
      else if (result.image_url) tags.push("✨ imagem atualizada");
      if (newCaption) tags.push("📝 legenda atualizada");
      assistantText = `${tags.join(" · ")}\n\n${assistantText}`;
    }

    if (currentSuggestionId) {
      await admin.from("social_post_chat_messages").insert({
        suggestion_id: currentSuggestionId,
        role: "ai",
        content: assistantText,
        version_id: newVersion?.id || null,
      });
    }

    result.ai_message = assistantText;
    result.action = toolCalls.length
      ? (toolCalls.find((t: any) => t.function?.name === "edit_image") && toolCalls.find((t: any) => t.function?.name === "rewrite_caption")
        ? "both"
        : toolCalls[0].function?.name === "edit_image" ? "image" : "caption")
      : "chat";

    return json(result, 200);
  } catch (e) {
    console.error("social-refine-image error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

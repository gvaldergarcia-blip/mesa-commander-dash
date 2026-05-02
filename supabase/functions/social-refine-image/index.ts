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

type RefineAction = "image" | "caption" | "both" | "chat";

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
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SRK);
    const body = await req.json().catch(() => ({}));
    const suggestionId = String(body.suggestionId || "").slice(0, 36);
    const assetId = String(body.assetId || "").slice(0, 36);
    const instruction = String(body.instruction || "").trim().slice(0, 1000);
    const forcedAction = body.action as RefineAction | undefined;

    if ((!suggestionId && !assetId) || !instruction) {
      return json({ error: "suggestionId ou assetId e instruction são obrigatórios" }, 400);
    }

    let ownerId: string | null = null;
    let restaurantId: string | null = null;
    let currentCaption = "";
    let currentImageUrl = "";
    let currentVersionNumber = 1;
    let currentSuggestionId: string | null = null;

    if (suggestionId) {
      const { data: suggestion } = await admin
        .from("social_post_suggestions")
        .select("id, restaurant_id, current_version_id, copy_text, restaurants:restaurant_id(owner_id)")
        .eq("id", suggestionId)
        .maybeSingle();

      if (!suggestion) return json({ error: "Suggestion not found" }, 404);

      ownerId = (suggestion as any).restaurants?.owner_id ?? null;
      restaurantId = suggestion.restaurant_id;
      currentCaption = suggestion.copy_text || "";
      currentSuggestionId = suggestion.id;

      const { data: currentVersion } = await admin
        .from("social_post_versions")
        .select("image_url, version_number")
        .eq("id", suggestion.current_version_id)
        .maybeSingle();

      if (!currentVersion?.image_url) return json({ error: "No current version" }, 404);
      currentImageUrl = currentVersion.image_url;
      currentVersionNumber = currentVersion.version_number || 1;
    } else {
      const { data: asset } = await admin
        .from("promotions_assets")
        .select("id, restaurant_id, image_url, caption_text, restaurants:restaurant_id(owner_id)")
        .eq("id", assetId)
        .maybeSingle();

      if (!asset) return json({ error: "Asset not found" }, 404);

      ownerId = (asset as any).restaurants?.owner_id ?? null;
      restaurantId = asset.restaurant_id;
      currentCaption = asset.caption_text || "";
      currentImageUrl = asset.image_url || "";

      if (!currentImageUrl) return json({ error: "No current image" }, 404);
    }

    if (ownerId !== user.id) {
      const { data: isAdm } = await admin.rpc("is_admin", { user_id: user.id });
      if (!isAdm) return json({ error: "Forbidden" }, 403);
    }

    if (currentSuggestionId) {
      await admin.from("social_post_chat_messages").insert({
        suggestion_id: currentSuggestionId,
        role: "user",
        content: instruction,
      });
    }

    let action: RefineAction = forcedAction || "chat";
    if (!forcedAction) {
      try {
        const cls = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  'Return only one word: image, caption, both, or chat. image=change image, caption=change only caption, both=change both, chat=answer without changing.',
              },
              { role: "user", content: instruction },
            ],
          }),
        });
        if (cls.ok) {
          const cj = await cls.json();
          const word = String(cj.choices?.[0]?.message?.content || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z]/g, "");
          if (["image", "caption", "both", "chat"].includes(word)) action = word as RefineAction;
        }
      } catch (_) {}
    }

    const result: Record<string, unknown> = { success: true, action };
    let newCaption: string | null = null;
    let newVersion: any = null;

    if (action === "image" || action === "both") {
      const editPrompt = `Edite a imagem anexada do post de restaurante obedecendo exatamente este pedido do dono:\n\n${instruction}\n\nRegras:\n- preserve o prato realista e apetitoso\n- respeite a identidade do restaurante\n- texto sempre em português do Brasil\n- formato quadrado 1:1\n- sem marca d'água`;

      const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      if (!imgResp.ok) {
        if (imgResp.status === 429) return json({ error: "Limite de requisições. Tente em alguns segundos." }, 429);
        if (imgResp.status === 402) return json({ error: "Créditos de IA insuficientes." }, 402);
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
        const { error: updErr } = await admin.from("promotions_assets").update({ image_url: pub.publicUrl }).eq("id", assetId);
        if (updErr) return json({ error: "Erro ao salvar imagem" }, 500);
        result.image_url = pub.publicUrl;
      }

      currentImageUrl = pub.publicUrl;
    }

    if (action === "caption" || action === "both") {
      const capResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você é um copywriter de Instagram para restaurantes brasileiros. Reescreva a legenda obedecendo exatamente o pedido do restaurante. Responda apenas com a nova legenda.",
            },
            { role: "user", content: `Legenda atual:\n\"\"\"${currentCaption || "(vazia)"}\"\"\"\n\nPedido: ${instruction}` },
          ],
        }),
      });

      if (!capResp.ok) {
        if (capResp.status === 429) return json({ error: "Limite de requisições. Tente em alguns segundos." }, 429);
        if (capResp.status === 402) return json({ error: "Créditos de IA insuficientes." }, 402);
        return json({ error: "Falha ao reescrever legenda" }, 500);
      }

      const cj = await capResp.json();
      newCaption = String(cj.choices?.[0]?.message?.content || "").trim();
      if (newCaption) {
        if (currentSuggestionId) {
          await admin.from("social_post_suggestions").update({ copy_text: newCaption }).eq("id", currentSuggestionId);
        } else {
          await admin.from("promotions_assets").update({ caption_text: newCaption }).eq("id", assetId);
        }
        result.copy_text = newCaption;
      }
    }

    let aiReply = "";
    if (action === "chat") {
      const chatResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você é o assistente de marketing do MesaClik. Responda em português do Brasil, curto e útil, focado em como melhorar a arte atual conforme o pedido do restaurante.",
            },
            { role: "user", content: `Legenda atual: \"${currentCaption || ""}\"\n\nPedido: ${instruction}` },
          ],
        }),
      });
      if (chatResp.ok) {
        const cj = await chatResp.json();
        aiReply = String(cj.choices?.[0]?.message?.content || "").trim();
      }
      if (!aiReply) aiReply = "Me diga exatamente o que você quer mudar na imagem e eu ajusto.";
    } else {
      const parts: string[] = [];
      if (newVersion) parts.push(`✅ Gerei a v${newVersion.version_number} com o ajuste pedido.`);
      else if (result.image_url) parts.push("✅ Atualizei a imagem com o ajuste pedido.");
      if (newCaption) parts.push(`✅ Atualizei a legenda.\n\n${newCaption}`);
      aiReply = parts.join("\n\n") || "Feito.";
    }

    if (currentSuggestionId) {
      await admin.from("social_post_chat_messages").insert({
        suggestion_id: currentSuggestionId,
        role: "ai",
        content: aiReply,
        version_id: newVersion?.id || null,
      });
    }

    result.ai_message = aiReply;
    return json(result, 200);
  } catch (e) {
    console.error("social-refine-image error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

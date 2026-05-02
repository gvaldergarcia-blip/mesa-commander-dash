import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SRK);
    const body = await req.json().catch(() => ({}));
    const suggestionId = String(body.suggestionId || "").slice(0, 36);
    const instruction = String(body.instruction || "").trim().slice(0, 1000);
    const forcedAction = body.action as ("image" | "caption" | "both" | "chat" | undefined);
    if (!suggestionId || !instruction) return json({ error: "suggestionId and instruction required" }, 400);

    // Load suggestion + ownership
    const { data: sug } = await admin
      .from("social_post_suggestions")
      .select("id, restaurant_id, current_version_id, copy_text, context_data, restaurants:restaurant_id(owner_id, name)")
      .eq("id", suggestionId)
      .maybeSingle();
    if (!sug) return json({ error: "Suggestion not found" }, 404);
    const ownerId = (sug as any).restaurants?.owner_id;
    if (ownerId !== user.id) {
      const { data: isAdm } = await admin.rpc("is_admin", { user_id: user.id });
      if (!isAdm) return json({ error: "Forbidden" }, 403);
    }

    const { data: currentVer } = await admin
      .from("social_post_versions")
      .select("id, image_url, version_number")
      .eq("id", sug.current_version_id)
      .maybeSingle();
    if (!currentVer) return json({ error: "No current version" }, 404);

    // Save user message
    await admin.from("social_post_chat_messages").insert({
      suggestion_id: suggestionId, role: "user", content: instruction,
    });

    // ── 1. Classify intent (unless forced) ──
    let action: "image" | "caption" | "both" | "chat" = forcedAction || "chat";
    if (!forcedAction) {
      try {
        const cls = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: `You classify a Brazilian restaurant owner's instruction about an Instagram post. Return ONLY one word from: image, caption, both, chat.
- image: edit the picture (colors, layout, text on image, background, style, props)
- caption: edit only the written caption / legenda below the post (tone, hashtags, length, CTA, emoji)
- both: change picture AND caption
- chat: question or comment that doesn't require changing image or caption` },
              { role: "user", content: instruction },
            ],
          }),
        });
        if (cls.ok) {
          const cj = await cls.json();
          const word = String(cj.choices?.[0]?.message?.content || "").toLowerCase().trim().replace(/[^a-z]/g, "");
          if (["image", "caption", "both", "chat"].includes(word)) action = word as any;
        }
      } catch (_) { /* fall back to chat */ }
    }

    const result: any = { success: true, action };

    // ── 2a. Image edit ──
    let newVersion: any = null;
    if (action === "image" || action === "both") {
      const editPrompt = `Edit the attached restaurant Instagram post image with these changes:

"${instruction}"

RULES:
- Keep the dish recognizable and appetizing.
- Brazilian Portuguese only — never Spanish. Avoid "con" (use "com"), "una" (use "uma"), "y" (use "e").
- All overlay text must be perfectly spelled. Less correct text > more incorrect text.
- No quotation marks around text. No watermarks. Square 1:1 aspect ratio.`;

      const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: currentVer.image_url } },
            ],
          }],
          modalities: ["image", "text"],
        }),
      });
      if (!imgResp.ok) {
        if (imgResp.status === 429) return json({ error: "Limite de requisições. Tente em alguns segundos." }, 429);
        if (imgResp.status === 402) return json({ error: "Créditos de IA insuficientes." }, 402);
        const t = await imgResp.text();
        console.error("image edit failed", imgResp.status, t);
        return json({ error: "Falha ao editar imagem" }, 500);
      }
      const imgJson = await imgResp.json();
      const base64 = imgJson.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!base64) return json({ error: "Nenhuma imagem gerada" }, 500);
      const b64data = base64.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(b64data), (c) => c.charCodeAt(0));
      const fileName = `${sug.restaurant_id}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await admin.storage.from("promotion-images").upload(fileName, bytes, { contentType: "image/png" });
      if (upErr) return json({ error: "Falha ao salvar imagem" }, 500);
      const { data: pub } = admin.storage.from("promotion-images").getPublicUrl(fileName);

      const newVersionNumber = currentVer.version_number + 1;
      const { data: nv, error: insErr } = await admin
        .from("social_post_versions")
        .insert({
          suggestion_id: suggestionId,
          version_number: newVersionNumber,
          image_url: pub.publicUrl,
          prompt_used: editPrompt,
          edit_instruction: instruction,
        })
        .select("*").single();
      if (insErr) return json({ error: "Erro ao salvar versão" }, 500);
      newVersion = nv;
      await admin.from("social_post_suggestions").update({ current_version_id: nv.id }).eq("id", suggestionId);
      result.version = nv;
    }

    // ── 2b. Caption edit ──
    let newCaption: string | null = null;
    if (action === "caption" || action === "both") {
      const capResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `Você é um copywriter pro Instagram de restaurantes brasileiros. Reescreva a legenda atual seguindo exatamente o pedido do dono. Mantenha em português do Brasil. Use emojis com moderação. Termine com 4-6 hashtags relevantes a menos que peçam diferente. Responda APENAS com a nova legenda — sem aspas, sem prefácio.` },
            { role: "user", content: `Legenda atual:\n"""${sug.copy_text || "(vazia)"}"""\n\nPedido do dono: ${instruction}` },
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
        await admin.from("social_post_suggestions").update({ copy_text: newCaption }).eq("id", suggestionId);
        result.copy_text = newCaption;
      }
    }

    // ── 2c. Chat-only response ──
    let aiReply = "";
    if (action === "chat") {
      const chatResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `Você é o assistente de marketing do MesaClik conversando com o dono de um restaurante sobre um post de Instagram. Responda em português do Brasil, curto e objetivo. Se ele pedir alteração na imagem ou legenda, lembre que basta dizer "edite a imagem pra..." ou "mude a legenda pra...".` },
            { role: "user", content: `Legenda atual: "${sug.copy_text || ""}"\n\nPergunta do dono: ${instruction}` },
          ],
        }),
      });
      if (chatResp.ok) {
        const cj = await chatResp.json();
        aiReply = String(cj.choices?.[0]?.message?.content || "").trim();
      }
      if (!aiReply) aiReply = "Pode me dizer o que você quer mudar na imagem ou na legenda?";
    } else {
      // Build a friendly confirmation
      const parts: string[] = [];
      if (newVersion) parts.push(`✅ Gerei a **v${newVersion.version_number}** da imagem com sua alteração.`);
      if (newCaption) parts.push(`✅ Reescrevi a legenda:\n\n> ${newCaption.split("\n").join("\n> ")}`);
      aiReply = parts.join("\n\n") || "Feito.";
    }

    await admin.from("social_post_chat_messages").insert({
      suggestion_id: suggestionId, role: "ai",
      content: aiReply,
      version_id: newVersion?.id || null,
    });
    result.ai_message = aiReply;

    return json(result, 200);
  } catch (e) {
    console.error("social-refine-image error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SRK);
    const body = await req.json();
    const suggestionId = String(body.suggestionId || "").slice(0, 36);
    const instruction = String(body.instruction || "").slice(0, 500);
    if (!suggestionId || !instruction) {
      return new Response(JSON.stringify({ error: "suggestionId and instruction required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load suggestion + current version + restaurant ownership
    const { data: sug } = await admin
      .from("social_post_suggestions")
      .select("id, restaurant_id, current_version_id, restaurants:restaurant_id(owner_id, name)")
      .eq("id", suggestionId)
      .maybeSingle();
    if (!sug) return new Response(JSON.stringify({ error: "Suggestion not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const ownerId = (sug as any).restaurants?.owner_id;
    if (ownerId !== user.id) {
      const { data: isAdm } = await admin.rpc("is_admin", { user_id: user.id });
      if (!isAdm) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: currentVer } = await admin
      .from("social_post_versions")
      .select("id, image_url, version_number")
      .eq("id", sug.current_version_id)
      .maybeSingle();
    if (!currentVer) return new Response(JSON.stringify({ error: "No current version" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Save user chat message
    await admin.from("social_post_chat_messages").insert({
      suggestion_id: suggestionId, role: "user", content: instruction,
    });

    const editPrompt = `Edit the attached restaurant Instagram post image with these changes:

"${instruction}"

RULES:
- Keep the dish recognizable and appetizing.
- Brazilian Portuguese only — never Spanish. Avoid "con" (use "com"), "una" (use "uma").
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
      if (imgResp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições. Tente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (imgResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await imgResp.text();
      console.error("image edit failed", imgResp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao editar imagem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const imgJson = await imgResp.json();
    const base64 = imgJson.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!base64) return new Response(JSON.stringify({ error: "Nenhuma imagem gerada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const b64data = base64.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(b64data), (c) => c.charCodeAt(0));
    const fileName = `${sug.restaurant_id}/${crypto.randomUUID()}.png`;
    const { error: upErr } = await admin.storage.from("promotion-images").upload(fileName, bytes, { contentType: "image/png" });
    if (upErr) return new Response(JSON.stringify({ error: "Falha ao salvar imagem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: pub } = admin.storage.from("promotion-images").getPublicUrl(fileName);

    const newVersionNumber = currentVer.version_number + 1;
    const { data: newVer, error: insErr } = await admin
      .from("social_post_versions")
      .insert({
        suggestion_id: suggestionId,
        version_number: newVersionNumber,
        image_url: pub.publicUrl,
        prompt_used: editPrompt,
        edit_instruction: instruction,
      })
      .select("*")
      .single();
    if (insErr) return new Response(JSON.stringify({ error: "Erro ao salvar versão" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await admin.from("social_post_suggestions").update({ current_version_id: newVer.id }).eq("id", suggestionId);

    await admin.from("social_post_chat_messages").insert({
      suggestion_id: suggestionId, role: "ai",
      content: `Pronto! Gerei a versão v${newVersionNumber} com a alteração solicitada.`,
      version_id: newVer.id,
    });

    return new Response(JSON.stringify({ success: true, version: newVer }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("social-refine-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
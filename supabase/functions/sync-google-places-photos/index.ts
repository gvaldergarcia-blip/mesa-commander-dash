import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!GOOGLE_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const restaurantId = typeof body.restaurant_id === "string" ? body.restaurant_id : "";
    if (!restaurantId) {
      return new Response(JSON.stringify({ error: "restaurant_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch restaurant info to compose query
    const { data: rest, error: restErr } = await supabase
      .from("restaurants")
      .select("id, name, address_line, city")
      .eq("id", restaurantId)
      .maybeSingle();
    if (restErr || !rest) {
      return new Response(JSON.stringify({ error: "Restaurante não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const query = [rest.name, rest.address_line, rest.city].filter(Boolean).join(" ");

    // 1) Places API (New): text search to find the place + photos in one call
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.photos",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1, languageCode: "pt-BR" }),
    });
    if (!searchRes.ok) {
      const t = await searchRes.text();
      console.error("Places searchText error:", searchRes.status, t);
      return new Response(
        JSON.stringify({ error: `Google Places API: ${searchRes.status}. ${t.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const searchData = await searchRes.json();
    const place = searchData?.places?.[0];
    if (!place) {
      return new Response(
        JSON.stringify({ error: "Restaurante não encontrado no Google. Verifique nome e endereço ou faça upload manual." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const photos = (place.photos ?? []).slice(0, 6);
    if (photos.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma foto encontrada no Google para este local. Faça upload manual." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limpa fotos antigas do Google deste restaurante (mantém manuais)
    const { data: oldGoogle } = await supabase
      .from("restaurant_ambient_photos")
      .select("id, photo_url")
      .eq("restaurant_id", restaurantId)
      .eq("source", "google");
    if (oldGoogle && oldGoogle.length > 0) {
      const paths = oldGoogle
        .map((p: any) => {
          const idx = (p.photo_url as string).indexOf("/ambient-photos/");
          return idx >= 0 ? p.photo_url.slice(idx + "/ambient-photos/".length) : null;
        })
        .filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from("ambient-photos").remove(paths);
      await supabase
        .from("restaurant_ambient_photos")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("source", "google");
    }

    const saved: any[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photoName = photos[i].name; // e.g. "places/XXX/photos/YYY"
      if (!photoName) continue;
      const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1600&key=${GOOGLE_API_KEY}`;
      const photoRes = await fetch(photoUrl);
      if (!photoRes.ok) {
        const t = await photoRes.text();
        console.error("photo fetch error", i, photoRes.status, t.slice(0, 200));
        continue;
      }
      const arrayBuffer = await photoRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const fileName = `${restaurantId}/google_${i}_${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from("ambient-photos")
        .upload(fileName, bytes, { contentType: "image/jpeg", upsert: true });
      if (upErr) {
        console.error("upload error", upErr);
        continue;
      }
      const { data: urlData } = supabase.storage.from("ambient-photos").getPublicUrl(fileName);

      const { data: row } = await supabase
        .from("restaurant_ambient_photos")
        .insert({
          restaurant_id: restaurantId,
          photo_url: urlData.publicUrl,
          source: "google",
          position: i,
        })
        .select()
        .single();
      if (row) saved.push(row);
    }

    return new Response(JSON.stringify({ success: true, count: saved.length, photos: saved }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-google-places-photos error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
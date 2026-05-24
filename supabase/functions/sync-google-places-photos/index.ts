import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type GooglePhotoCandidate = {
  name: string;
  mediaUrl: string;
};

type SearchAttempt = {
  ok: boolean;
  source: "places-new" | "places-legacy";
  placeFound: boolean;
  photos: GooglePhotoCandidate[];
  errorMessage?: string;
  status?: number;
};

async function searchPlacesNew(apiKey: string, query: string): Promise<SearchAttempt> {
  const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.photos",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1, languageCode: "pt-BR" }),
  });

  if (!searchRes.ok) {
    const text = await searchRes.text();
    console.error("Places searchText error:", searchRes.status, text);
    return {
      ok: false,
      source: "places-new",
      placeFound: false,
      photos: [],
      status: searchRes.status,
      errorMessage: `Places API (New): ${searchRes.status}. ${text.slice(0, 240)}`,
    };
  }

  const searchData = await searchRes.json();
  const place = searchData?.places?.[0];
  const photos = (place?.photos ?? []).slice(0, 6).map((photo: any) => ({
    name: photo?.name,
    mediaUrl: photo?.name
      ? `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1600&key=${apiKey}`
      : "",
  })).filter((photo: GooglePhotoCandidate) => !!photo.name && !!photo.mediaUrl);

  return {
    ok: true,
    source: "places-new",
    placeFound: !!place,
    photos,
  };
}

async function searchPlacesLegacy(apiKey: string, query: string): Promise<SearchAttempt> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  url.searchParams.set("input", query);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set("fields", "place_id,name,formatted_address,photos");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", apiKey);

  const searchRes = await fetch(url.toString());
  if (!searchRes.ok) {
    const text = await searchRes.text();
    console.error("Places legacy findplacefromtext HTTP error:", searchRes.status, text);
    return {
      ok: false,
      source: "places-legacy",
      placeFound: false,
      photos: [],
      status: searchRes.status,
      errorMessage: `Places API (legacy): ${searchRes.status}. ${text.slice(0, 240)}`,
    };
  }

  const searchData = await searchRes.json();
  const apiStatus = searchData?.status;
  if (apiStatus && apiStatus !== "OK" && apiStatus !== "ZERO_RESULTS") {
    const errorMessage = [searchData?.error_message, apiStatus].filter(Boolean).join(" - ");
    console.error("Places legacy findplacefromtext API error:", errorMessage);
    return {
      ok: false,
      source: "places-legacy",
      placeFound: false,
      photos: [],
      errorMessage: `Places API (legacy): ${errorMessage || "erro desconhecido"}`,
    };
  }

  const place = searchData?.candidates?.[0];
  const photos = (place?.photos ?? []).slice(0, 6).map((photo: any) => ({
    name: photo?.photo_reference,
    mediaUrl: photo?.photo_reference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${encodeURIComponent(photo.photo_reference)}&key=${apiKey}`
      : "",
  })).filter((photo: GooglePhotoCandidate) => !!photo.name && !!photo.mediaUrl);

  return {
    ok: true,
    source: "places-legacy",
    placeFound: !!place,
    photos,
  };
}

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

    const attemptNew = await searchPlacesNew(GOOGLE_API_KEY, query);
    const searchAttempt = attemptNew.ok && attemptNew.placeFound && attemptNew.photos.length > 0
      ? attemptNew
      : await searchPlacesLegacy(GOOGLE_API_KEY, query);

    if (!searchAttempt.ok) {
      const details = [attemptNew.errorMessage, searchAttempt.errorMessage]
        .filter(Boolean)
        .join(" | fallback: ");
      return new Response(
        JSON.stringify({
          error: details || "Não foi possível consultar o Google Places com a chave configurada.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!searchAttempt.placeFound) {
      return new Response(
        JSON.stringify({ error: "Restaurante não encontrado no Google. Verifique nome e endereço ou faça upload manual." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (searchAttempt.photos.length === 0) {
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
    for (let i = 0; i < searchAttempt.photos.length; i++) {
      const photo = searchAttempt.photos[i];
      if (!photo?.name || !photo?.mediaUrl) continue;
      const photoRes = await fetch(photo.mediaUrl);
      if (!photoRes.ok) {
        const t = await photoRes.text();
        console.error("photo fetch error", searchAttempt.source, i, photoRes.status, t.slice(0, 200));
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
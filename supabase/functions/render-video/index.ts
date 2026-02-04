import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      restaurant_id,
      restaurant_name,
      location,
      promo_text,
      template,
      duration,
      cta_type,
      cta_custom,
      image_urls,
      logo_url,
    } = await req.json();

    console.log("Render video request:", {
      restaurant_id,
      restaurant_name,
      template,
      duration,
      image_count: image_urls?.length,
    });

    // Validate required fields
    if (!restaurant_id || !restaurant_name || !template || !duration || !image_urls?.length) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: restaurant_id, restaurant_name, template, duration, image_urls",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate template
    if (!["A", "B", "C"].includes(template)) {
      return new Response(
        JSON.stringify({ error: "Invalid template. Must be A, B, or C" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate duration
    if (![7, 15, 30].includes(duration)) {
      return new Response(
        JSON.stringify({ error: "Invalid duration. Must be 7, 15, or 30" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate image count
    if (image_urls.length < 3 || image_urls.length > 8) {
      return new Response(
        JSON.stringify({ error: "Image count must be between 3 and 8" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check monthly usage limit
    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-02"
    
    const { data: usageData, error: usageError } = await supabase
      .from("video_usage")
      .select("videos_generated")
      .eq("restaurant_id", restaurant_id)
      .eq("month_year", currentMonth)
      .single();

    if (usageError && usageError.code !== "PGRST116") {
      console.error("Error checking usage:", usageError);
    }

    const currentUsage = usageData?.videos_generated || 0;
    const MONTHLY_LIMIT = 3; // Free plan limit

    if (currentUsage >= MONTHLY_LIMIT) {
      return new Response(
        JSON.stringify({
          error: `Limite mensal atingido (${MONTHLY_LIMIT} vídeos). Aguarde o próximo mês ou faça upgrade.`,
          usage: { current: currentUsage, limit: MONTHLY_LIMIT },
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from("video_jobs")
      .insert({
        restaurant_id,
        restaurant_name,
        location: location || null,
        promo_text: promo_text || null,
        template,
        duration,
        cta_type: cta_type || null,
        cta_custom: cta_custom || null,
        image_urls,
        logo_url: logo_url || null,
        status: "queued",
      })
      .select()
      .single();

    if (jobError) {
      console.error("Error creating job:", jobError);
      return new Response(
        JSON.stringify({ error: "Failed to create video job", details: jobError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Video job created:", job.id);

    // Return job ID immediately (async processing)
    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        status: "queued",
        message: "Video generation started. Check status endpoint for updates.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Render video error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

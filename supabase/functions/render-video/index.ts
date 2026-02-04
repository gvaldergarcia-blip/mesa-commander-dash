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

    // Note: Monthly limit check removed for development
    // In production, implement proper subscription-based limits

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

    // Trigger processing in background (fire and forget)
    const processPromise = (async () => {
      try {
        console.log("Starting background video processing for job:", job.id);
        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/process-video`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ job_id: job.id }),
          }
        );
        const processResult = await processResponse.json();
        console.log("Background processing result:", processResult);
      } catch (err) {
        console.error("Background processing error:", err);
      }
    })();

    // Use waitUntil if available (Supabase Edge Runtime)
    if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
      (globalThis as any).EdgeRuntime.waitUntil(processPromise);
    } else {
      // Fallback: just let it run (response returns first)
      processPromise.catch(console.error);
    }

    // Return job ID immediately
    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        status: "queued",
        message: "Video generation started. Processing in background.",
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

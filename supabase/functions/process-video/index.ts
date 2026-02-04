import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// This function processes queued video jobs
// Note: Actual video rendering is done client-side using the images
// This function prepares the job and marks it as ready for client rendering
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get job_id from request body if provided
    let jobId: string | null = null;
    try {
      const body = await req.json();
      jobId = body.job_id || null;
    } catch {
      // No body provided
    }

    let job;
    if (jobId) {
      // Fetch specific job
      const { data, error } = await supabase
        .from("video_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      
      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Job not found", details: error?.message }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      job = data;
    } else {
      // Get next queued job
      const { data: jobs, error: fetchError } = await supabase
        .from("video_jobs")
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1);

      if (fetchError) {
        console.error("Error fetching queued jobs:", fetchError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch jobs", details: fetchError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!jobs || jobs.length === 0) {
        return new Response(
          JSON.stringify({ message: "No queued jobs to process" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      job = jobs[0];
    }

    console.log("Processing job:", job.id);

    // Mark as ready for client-side rendering
    const { error: updateError } = await supabase
      .from("video_jobs")
      .update({
        status: "done",
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) {
      throw updateError;
    }

    // Update monthly usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const { data: existingUsage } = await supabase
      .from("video_usage")
      .select("id, videos_generated")
      .eq("restaurant_id", job.restaurant_id)
      .eq("month_year", currentMonth)
      .single();

    if (existingUsage) {
      await supabase
        .from("video_usage")
        .update({
          videos_generated: existingUsage.videos_generated + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUsage.id);
    } else {
      await supabase
        .from("video_usage")
        .insert({
          restaurant_id: job.restaurant_id,
          month_year: currentMonth,
          videos_generated: 1,
        });
    }

    console.log("Job processed:", job.id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        status: "done",
        message: "Video job ready. Images available for slideshow.",
        image_urls: job.image_urls,
        template: job.template,
        duration: job.duration,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Process video error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

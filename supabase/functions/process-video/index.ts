import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// This function processes queued video jobs
// It should be called periodically (cron) or triggered after job creation

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      console.log("No queued jobs to process");
      return new Response(
        JSON.stringify({ message: "No queued jobs to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const job = jobs[0];
    console.log("Processing job:", job.id);

    // Update status to rendering
    await supabase
      .from("video_jobs")
      .update({ status: "rendering", updated_at: new Date().toISOString() })
      .eq("id", job.id);

    try {
      // Build video prompt based on template
      let videoPrompt = "";
      
      switch (job.template) {
        case "A": // Promo Rápida
          videoPrompt = `Cinematic restaurant promotional video. Start with bold text "${job.promo_text || 'Oferta Especial'}" appearing dramatically. Smooth transitions through appetizing food images. End with call-to-action. Professional, modern, appetizing atmosphere. 9:16 vertical format for social media.`;
          break;
        case "B": // Apresentação
          videoPrompt = `Elegant restaurant presentation video. Open with "${job.restaurant_name}" title and "${job.location || ''}" subtitle. Showcase the ambiance, dishes, and drinks with smooth cinematic transitions. Professional, inviting atmosphere. 9:16 vertical format.`;
          break;
        case "C": // Cardápio/Pratos
          videoPrompt = `Food showcase video for restaurant. Display each dish beautifully with gentle zoom and pan effects. Appetizing, professional food photography style. Warm lighting, close-up details. 9:16 vertical format for social media.`;
          break;
        default:
          videoPrompt = `Restaurant promotional video featuring ${job.restaurant_name}. Cinematic food shots with smooth transitions. Professional, appetizing, modern style. 9:16 vertical format.`;
      }

      // Add CTA info if provided
      if (job.cta_type) {
        const ctaTexts: Record<string, string> = {
          reserve: "Reserve agora",
          queue: "Entre na fila",
          whatsapp: "Chame no WhatsApp",
          custom: job.cta_custom || "Saiba mais",
        };
        videoPrompt += ` End with "${ctaTexts[job.cta_type] || ctaTexts.custom}" call-to-action.`;
      }

      console.log("Video prompt:", videoPrompt);

      // For MVP: We'll mark as done with placeholder
      // In production, this would call a video generation API
      // The frontend will use Lovable's videogen tool for actual generation

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update job as done (frontend will handle actual video generation)
      const { error: updateError } = await supabase
        .from("video_jobs")
        .update({
          status: "done",
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          // Video URL will be set by frontend after generation
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

      console.log("Job completed successfully:", job.id);

      return new Response(
        JSON.stringify({
          success: true,
          job_id: job.id,
          status: "done",
          message: "Video job processed successfully",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (processError: unknown) {
      console.error("Error processing video:", processError);
      const processErrorMessage = processError instanceof Error ? processError.message : "Unknown error during processing";

      // Mark job as failed
      await supabase
        .from("video_jobs")
        .update({
          status: "failed",
          error_message: processErrorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return new Response(
        JSON.stringify({
          error: "Video processing failed",
          job_id: job.id,
          details: processErrorMessage,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Process video error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

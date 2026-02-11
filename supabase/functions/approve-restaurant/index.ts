import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { application_id, action, admin_token } = await req.json();

    if (!application_id || !action) {
      return new Response(
        JSON.stringify({ error: "application_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be 'approve' or 'reject'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate admin: check via token OR allow if called from admin context
    let adminUserId: string | null = null;
    if (admin_token) {
      const { data: adminUser, error: authErr } = await supabaseAdmin.auth.getUser(admin_token);
      if (authErr || !adminUser?.user) {
        return new Response(
          JSON.stringify({ error: "Invalid admin token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      adminUserId = adminUser.user.id;
      // Check admin role
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", adminUserId)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: "User is not an admin" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Check Authorization header
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const { data: adminUser } = await supabaseAdmin.auth.getUser(token);
        if (adminUser?.user) {
          adminUserId = adminUser.user.id;
          const { data: adminRole } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", adminUserId)
            .eq("role", "admin")
            .maybeSingle();
          if (!adminRole) {
            return new Response(
              JSON.stringify({ error: "User is not an admin" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // 1. Fetch the application
    const { data: application, error: appErr } = await supabaseAdmin
      .from("restaurant_applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (appErr || !application) {
      return new Response(
        JSON.stringify({ error: "Application not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (application.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Application already ${application.status}` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== REJECT ==========
    if (action === "reject") {
      await supabaseAdmin
        .from("restaurant_applications")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
          rejected_by: adminUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", application_id);

      return new Response(
        JSON.stringify({ success: true, action: "rejected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== APPROVE — PROVISION EVERYTHING ==========

    // Step A: Create restaurant in PUBLIC schema (panel reads from here)
    const { data: restaurant, error: restErr } = await supabaseAdmin
      .from("restaurants")
      .insert({
        name: application.restaurant_name,
        cuisine: application.cuisine || "Outros",
        address_line: application.address_line || null,
        city: application.city || null,
        owner_id: application.owner_user_id,
        has_queue: true,
        has_reservation: true,
      })
      .select("id")
      .single();

    if (restErr || !restaurant) {
      console.error("Error creating restaurant in public:", restErr);
      return new Response(
        JSON.stringify({ error: "Failed to create restaurant", details: restErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const restaurantId = restaurant.id;
    console.log(`Restaurant created in public: ${restaurantId}`);

    // Step A2: Also create in mesaclik schema (operational RPCs use this)
    const { error: mesaclikRestErr } = await supabaseAdmin
      .schema("mesaclik" as any)
      .from("restaurants")
      .insert({
        id: restaurantId, // same ID for consistency
        name: application.restaurant_name,
        cuisine: application.cuisine || "Outros",
        address_line: application.address_line || null,
        district: application.district || null,
        city: application.city || null,
        state: application.state || null,
        zip_code: application.zip_code || null,
        owner_id: application.owner_user_id,
        is_active: true,
        has_queue: true,
        has_reservation: true,
      });

    if (mesaclikRestErr) {
      console.error("Error creating restaurant in mesaclik (non-fatal):", mesaclikRestErr);
      // Non-fatal: panel works from public, mesaclik can be synced later
    } else {
      console.log(`Restaurant also created in mesaclik: ${restaurantId}`);
    }

    // Step B: CRITICAL — Create restaurant_members link
    const { error: memberErr } = await supabaseAdmin
      .from("restaurant_members")
      .insert({
        user_id: application.owner_user_id,
        restaurant_id: restaurantId,
        role: "owner",
      });

    if (memberErr) {
      console.error("Error creating restaurant_members:", memberErr);
      // Rollback: delete restaurant from both schemas
      await supabaseAdmin.from("restaurants").delete().eq("id", restaurantId);
      await supabaseAdmin.schema("mesaclik" as any).from("restaurants").delete().eq("id", restaurantId);
      return new Response(
        JSON.stringify({ error: "Failed to link user to restaurant", details: memberErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step C: Create default queue
    const { error: queueErr } = await supabaseAdmin
      .schema("mesaclik" as any)
      .from("queues")
      .insert({
        restaurant_id: restaurantId,
        name: "Fila Principal",
        is_active: true,
      });

    if (queueErr) {
      console.error("Error creating queue:", queueErr);
    }

    // Step D: Create default settings (public schema — triggers sync to mesaclik)
    const { error: qsErr } = await supabaseAdmin
      .from("queue_settings")
      .insert({
        restaurant_id: restaurantId,
        queue_capacity: 50,
        max_party_size: 10,
        tolerance_minutes: 15,
        avg_time_1_2: 15,
        avg_time_3_4: 20,
        avg_time_5_6: 25,
        avg_time_7_8: 30,
      });

    if (qsErr) {
      console.error("Error creating queue_settings:", qsErr);
    }

    const { error: rsErr } = await supabaseAdmin
      .from("reservation_settings")
      .insert({
        restaurant_id: restaurantId,
        max_party_size: 20,
        tolerance_minutes: 15,
      });

    if (rsErr) {
      console.error("Error creating reservation_settings:", rsErr);
    }

    // Step E: Create trial subscription (30 days)
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        restaurant_id: restaurantId,
        plan_type: "trial",
        status: "trialing",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
      });

    if (subErr) {
      console.error("Error creating subscription:", subErr);
    }

    // Step F: Update application status
    await supabaseAdmin
      .from("restaurant_applications")
      .update({
        status: "approved",
        restaurant_id: restaurantId,
        approved_at: now.toISOString(),
        approved_by: adminUserId,
        updated_at: now.toISOString(),
      })
      .eq("id", application_id);

    console.log(`Restaurant ${restaurantId} fully provisioned for user ${application.owner_user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        action: "approved",
        restaurant_id: restaurantId,
        trial_ends_at: trialEnd.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with caller's token to verify identity
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get caller's membership & verify admin role
    const { data: callerMembership } = await adminClient
      .from("restaurant_members")
      .select("restaurant_id, role")
      .eq("user_id", caller.id)
      .limit(1)
      .single();

    if (!callerMembership) {
      return new Response(
        JSON.stringify({ error: "Sem restaurante associado" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const callerRole = (callerMembership.role || "").toLowerCase();
    if (callerRole !== "admin" && callerRole !== "owner") {
      return new Response(
        JSON.stringify({
          error: "Apenas administradores podem gerenciar a equipe",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const restaurantId = callerMembership.restaurant_id;
    const body = await req.json();
    const { action } = body;

    // ── LIST TEAM ──
    if (action === "list") {
      const { data: members, error } = await adminClient
        .from("restaurant_members")
        .select("user_id, role, created_at")
        .eq("restaurant_id", restaurantId);

      if (error) throw error;

      // Enrich with profile data
      const enriched = await Promise.all(
        (members || []).map(async (m: any) => {
          const {
            data: { user },
          } = await adminClient.auth.admin.getUserById(m.user_id);
          return {
            user_id: m.user_id,
            role: m.role || "operator",
            created_at: m.created_at,
            email: user?.email || "",
            name:
              user?.user_metadata?.full_name ||
              user?.user_metadata?.name ||
              user?.email ||
              "",
            is_active: !user?.banned_until,
          };
        })
      );

      return new Response(JSON.stringify({ members: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE OPERATOR ──
    if (action === "create") {
      const { name, email } = body;
      if (!name || !email) {
        return new Response(
          JSON.stringify({ error: "Nome e email são obrigatórios" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Generate temporary password
      const tempPassword =
        Math.random().toString(36).slice(-4).toUpperCase() +
        Math.random().toString(36).slice(-4) +
        "!";

      // Check if user already exists
      const { data: existingUsers } =
        await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );

      let userId: string;

      if (existingUser) {
        // Check if already a member of this restaurant
        const { data: existingMember } = await adminClient
          .from("restaurant_members")
          .select("user_id")
          .eq("restaurant_id", restaurantId)
          .eq("user_id", existingUser.id)
          .maybeSingle();

        if (existingMember) {
          return new Response(
            JSON.stringify({
              error: "Este email já está cadastrado neste restaurante",
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        userId = existingUser.id;
        // Update password for existing user
        await adminClient.auth.admin.updateUserById(userId, {
          password: tempPassword,
          user_metadata: { full_name: name },
        });
      } else {
        // Create new auth user
        const { data: newUser, error: createError } =
          await adminClient.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: name },
          });

        if (createError) throw createError;
        userId = newUser.user!.id;

        // Create profile
        await adminClient.from("profiles").upsert({
          id: userId,
          email,
          full_name: name,
        });
      }

      // Add to restaurant_members as operator
      const { error: memberError } = await adminClient
        .from("restaurant_members")
        .insert({
          user_id: userId,
          restaurant_id: restaurantId,
          role: "operator",
        });

      if (memberError) throw memberError;

      return new Response(
        JSON.stringify({
          success: true,
          temp_password: tempPassword,
          user_id: userId,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── TOGGLE ACTIVE ──
    if (action === "toggle_active") {
      const { target_user_id, is_active } = body;

      // Prevent deactivating self
      if (target_user_id === caller.id) {
        return new Response(
          JSON.stringify({
            error: "Você não pode desativar sua própria conta",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify target belongs to same restaurant
      const { data: targetMember } = await adminClient
        .from("restaurant_members")
        .select("role")
        .eq("restaurant_id", restaurantId)
        .eq("user_id", target_user_id)
        .maybeSingle();

      if (!targetMember) {
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado no restaurante" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (is_active) {
        await adminClient.auth.admin.updateUserById(target_user_id, {
          ban_duration: "none",
        });
      } else {
        await adminClient.auth.admin.updateUserById(target_user_id, {
          ban_duration: "876000h", // ~100 years
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESET PASSWORD ──
    if (action === "reset_password") {
      const { target_user_id } = body;

      // Verify target belongs to same restaurant
      const { data: targetMember } = await adminClient
        .from("restaurant_members")
        .select("role")
        .eq("restaurant_id", restaurantId)
        .eq("user_id", target_user_id)
        .maybeSingle();

      if (!targetMember) {
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado no restaurante" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const newPassword =
        Math.random().toString(36).slice(-4).toUpperCase() +
        Math.random().toString(36).slice(-4) +
        "!";

      await adminClient.auth.admin.updateUserById(target_user_id, {
        password: newPassword,
      });

      return new Response(
        JSON.stringify({ success: true, temp_password: newPassword }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[manage-team] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

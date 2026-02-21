import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrollRequest {
  restaurant_id: string;
  action: "save_program" | "check_reward" | "activate_customer" | "deactivate_customer";
  customer_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: EnrollRequest = await req.json();
    const { restaurant_id, action } = body;

    // Fetch program config
    const { data: program, error: progError } = await supabase
      .from("restaurant_loyalty_program")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (progError) throw progError;
    if (!program || !program.is_active) {
      return new Response(JSON.stringify({ message: "Program not active" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch restaurant name
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurant_id)
      .single();

    const restaurantName = restaurant?.name || "Restaurante";

    // ─── ACTIVATE CUSTOMER ───────────────────────────────────────
    if (action === "activate_customer" && body.customer_id) {
      const { data: cust } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, total_queue_visits, total_reservation_visits, marketing_optin")
        .eq("id", body.customer_id)
        .single();

      if (!cust) {
        return new Response(JSON.stringify({ error: "Customer not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!cust.marketing_optin) {
        return new Response(JSON.stringify({ error: "Customer has not opted in to marketing" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Mark customer as loyalty active
      await supabase
        .from("restaurant_customers")
        .update({ loyalty_program_active: true })
        .eq("id", cust.id);

      // Calculate visits
      let visits = 0;
      if (program.count_queue) visits += (cust.total_queue_visits || 0);
      if (program.count_reservations) visits += (cust.total_reservation_visits || 0);

      const rewardUnlocked = visits >= program.required_visits;
      const now = new Date();
      const rewardExpiresAt = rewardUnlocked
        ? new Date(now.getTime() + program.reward_validity_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Upsert loyalty status
      const { data: existing } = await supabase
        .from("customer_loyalty_status")
        .select("id, activation_email_sent, reward_email_sent, reward_unlocked")
        .eq("restaurant_id", restaurant_id)
        .eq("customer_id", cust.id)
        .maybeSingle();

      let emailsSent = 0;

      if (existing) {
        await supabase
          .from("customer_loyalty_status")
          .update({
            current_visits: visits,
            reward_unlocked: rewardUnlocked,
            reward_unlocked_at: rewardUnlocked && !existing.reward_unlocked ? now.toISOString() : undefined,
            reward_expires_at: rewardUnlocked ? rewardExpiresAt : null,
          })
          .eq("id", existing.id);

        // Send activation email if not sent yet
        if (!existing.activation_email_sent && cust.customer_email) {
          const visitsRemaining = Math.max(0, program.required_visits - visits);
          await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
          await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("id", existing.id);
          emailsSent++;
        }

        // Send reward email if just unlocked
        if (rewardUnlocked && !existing.reward_email_sent && cust.customer_email) {
          await sendRewardEmail(cust, program, restaurantName);
          await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", existing.id);
          emailsSent++;
        }
      } else {
        await supabase.from("customer_loyalty_status").insert({
          restaurant_id,
          customer_id: cust.id,
          current_visits: visits,
          reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked ? now.toISOString() : null,
          reward_expires_at: rewardExpiresAt,
          activation_email_sent: false,
          reward_email_sent: false,
        });

        // Send activation email
        if (cust.customer_email) {
          const visitsRemaining = Math.max(0, program.required_visits - visits);
          await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
          await supabase
            .from("customer_loyalty_status")
            .update({ activation_email_sent: true })
            .eq("restaurant_id", restaurant_id)
            .eq("customer_id", cust.id);
          emailsSent++;

          if (rewardUnlocked) {
            await sendRewardEmail(cust, program, restaurantName);
            await supabase
              .from("customer_loyalty_status")
              .update({ reward_email_sent: true })
              .eq("restaurant_id", restaurant_id)
              .eq("customer_id", cust.id);
            emailsSent++;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, visits, rewardUnlocked, emailsSent }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── DEACTIVATE CUSTOMER ─────────────────────────────────────
    if (action === "deactivate_customer" && body.customer_id) {
      await supabase
        .from("restaurant_customers")
        .update({ loyalty_program_active: false })
        .eq("id", body.customer_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── SAVE PROGRAM (bulk enroll) ──────────────────────────────
    if (action === "save_program") {
      const { data: customers, error: custError } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, total_queue_visits, total_reservation_visits, marketing_optin")
        .eq("restaurant_id", restaurant_id);

      if (custError) throw custError;

      let enrolled = 0;
      let emailsSent = 0;

      for (const cust of customers || []) {
        let visits = 0;
        if (program.count_queue) visits += (cust.total_queue_visits || 0);
        if (program.count_reservations) visits += (cust.total_reservation_visits || 0);

        const rewardUnlocked = visits >= program.required_visits;
        const now = new Date();
        const rewardExpiresAt = rewardUnlocked
          ? new Date(now.getTime() + program.reward_validity_days * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const { data: existing } = await supabase
          .from("customer_loyalty_status")
          .select("id, activation_email_sent, reward_email_sent, reward_unlocked")
          .eq("restaurant_id", restaurant_id)
          .eq("customer_id", cust.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("customer_loyalty_status")
            .update({
              current_visits: visits,
              reward_unlocked: rewardUnlocked,
              reward_unlocked_at: rewardUnlocked && !existing.reward_unlocked ? now.toISOString() : undefined,
              reward_expires_at: rewardUnlocked ? rewardExpiresAt : null,
            })
            .eq("id", existing.id);

          if (rewardUnlocked && !existing.reward_email_sent && cust.marketing_optin && cust.customer_email) {
            await sendRewardEmail(cust, program, restaurantName);
            await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", existing.id);
            emailsSent++;
          }
        } else {
          await supabase.from("customer_loyalty_status").insert({
            restaurant_id,
            customer_id: cust.id,
            current_visits: visits,
            reward_unlocked: rewardUnlocked,
            reward_unlocked_at: rewardUnlocked ? now.toISOString() : null,
            reward_expires_at: rewardExpiresAt,
            activation_email_sent: false,
            reward_email_sent: false,
          });

          if (cust.marketing_optin && cust.customer_email) {
            const visitsRemaining = Math.max(0, program.required_visits - visits);
            await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
            await supabase
              .from("customer_loyalty_status")
              .update({ activation_email_sent: true })
              .eq("restaurant_id", restaurant_id)
              .eq("customer_id", cust.id);
            emailsSent++;

            if (rewardUnlocked) {
              await sendRewardEmail(cust, program, restaurantName);
              await supabase
                .from("customer_loyalty_status")
                .update({ reward_email_sent: true })
                .eq("restaurant_id", restaurant_id)
                .eq("customer_id", cust.id);
              emailsSent++;
            }
          }
          enrolled++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, enrolled, emailsSent, totalCustomers: customers?.length || 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── CHECK REWARD (single customer) ──────────────────────────
    if (action === "check_reward" && body.customer_id) {
      const { data: cust } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, total_queue_visits, total_reservation_visits, marketing_optin, loyalty_program_active")
        .eq("id", body.customer_id)
        .single();

      if (!cust) {
        return new Response(JSON.stringify({ message: "Customer not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Only count if individually activated
      if (!cust.loyalty_program_active) {
        return new Response(JSON.stringify({ message: "Customer not enrolled in loyalty program" }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      let visits = 0;
      if (program.count_queue) visits += (cust.total_queue_visits || 0);
      if (program.count_reservations) visits += (cust.total_reservation_visits || 0);

      const rewardUnlocked = visits >= program.required_visits;
      const now = new Date();

      const { data: status } = await supabase
        .from("customer_loyalty_status")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .eq("customer_id", cust.id)
        .maybeSingle();

      if (status) {
        await supabase
          .from("customer_loyalty_status")
          .update({
            current_visits: visits,
            reward_unlocked: rewardUnlocked,
            reward_unlocked_at: rewardUnlocked && !status.reward_unlocked ? now.toISOString() : status.reward_unlocked_at,
            reward_expires_at: rewardUnlocked
              ? new Date(now.getTime() + program.reward_validity_days * 24 * 60 * 60 * 1000).toISOString()
              : null,
          })
          .eq("id", status.id);

        if (rewardUnlocked && !status.reward_email_sent && cust.marketing_optin && cust.customer_email) {
          await sendRewardEmail(cust, program, restaurantName);
          await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", status.id);
        }
      } else {
        const rewardExpiresAt = rewardUnlocked
          ? new Date(now.getTime() + program.reward_validity_days * 24 * 60 * 60 * 1000).toISOString()
          : null;
        
        await supabase.from("customer_loyalty_status").insert({
          restaurant_id,
          customer_id: cust.id,
          current_visits: visits,
          reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked ? now.toISOString() : null,
          reward_expires_at: rewardExpiresAt,
        });
      }

      return new Response(
        JSON.stringify({ success: true, visits, rewardUnlocked }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in loyalty-enroll:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

async function sendActivationEmail(
  customer: any, program: any, restaurantName: string,
  currentVisits: number, visitsRemaining: number
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Você entrou no ${program.program_name}!</h1>
      </div>
      <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="color: #374151; font-size: 16px;">Olá, <strong>${customer.customer_name || 'Cliente'}</strong>!</p>
        <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
          Você agora faz parte do <strong>${program.program_name}</strong> do <strong>${restaurantName}</strong> 🍽️
        </p>
        <p style="color: #6b7280; font-size: 16px;">Funciona assim:</p>
        <ul style="color: #6b7280; font-size: 15px; line-height: 1.8;">
          <li>A cada visita concluída, você acumula <strong>1 clique</strong>.</li>
          <li>Ao completar <strong>${program.required_visits} visitas</strong>, você ganha:</li>
        </ul>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #92400e; font-size: 18px; font-weight: bold;">🎁 ${program.reward_description}</p>
        </div>
        <p style="color: #374151; font-size: 16px;">
          Atualmente você já tem <strong>${currentVisits} visitas</strong> registradas.<br>
          Faltam apenas <strong>${visitsRemaining}</strong> para desbloquear seu benefício!
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Esperamos você em breve 😉</p>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Equipe ${restaurantName}
        </p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: `MesaClik <noreply@mesaclik.com.br>`,
      to: [customer.customer_email],
      subject: `🎉 Você entrou no ${program.program_name} do ${restaurantName}!`,
      html,
    });
    console.log(`Activation email sent to ${customer.customer_email}`);
  } catch (err) {
    console.error(`Failed to send activation email to ${customer.customer_email}:`, err);
  }
}

async function sendRewardEmail(customer: any, program: any, restaurantName: string) {
  const expiresDate = new Date(Date.now() + program.reward_validity_days * 24 * 60 * 60 * 1000);
  const formattedExpiry = expiresDate.toLocaleDateString("pt-BR");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🏆 Parabéns! Recompensa desbloqueada!</h1>
      </div>
      <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="color: #374151; font-size: 16px;">Olá, <strong>${customer.customer_name || 'Cliente'}</strong>!</p>
        <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
          Você completou <strong>${program.required_visits} visitas</strong> no <strong>${restaurantName}</strong> 🎉
        </p>
        <p style="color: #6b7280; font-size: 16px;">Como prometido, você ganhou:</p>
        <div style="background: #dcfce7; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #166534; font-size: 18px; font-weight: bold;">🎁 ${program.reward_description}</p>
        </div>
        <p style="color: #ef4444; font-size: 14px;">⏰ Seu benefício é válido até <strong>${formattedExpiry}</strong>.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 0; color: #374151; font-size: 14px;">
            <strong>Como resgatar:</strong><br>
            Informe no atendimento que você faz parte do <strong>${program.program_name}</strong>.
          </p>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">Agradecemos por fazer parte da nossa história 💛</p>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          Equipe ${restaurantName}
        </p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: `MesaClik <noreply@mesaclik.com.br>`,
      to: [customer.customer_email],
      subject: `🏆 Parabéns! Você desbloqueou sua recompensa no ${restaurantName}`,
      html,
    });
    console.log(`Reward email sent to ${customer.customer_email}`);
  } catch (err) {
    console.error(`Failed to send reward email to ${customer.customer_email}:`, err);
  }
}

serve(handler);
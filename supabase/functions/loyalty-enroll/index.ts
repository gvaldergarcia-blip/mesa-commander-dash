import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// ── Email sender addresses ──
const RESEND_FROM_TRANSACTIONAL =
  Deno.env.get("RESEND_FROM_TRANSACTIONAL") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "notify@mesaclik.com.br";
const RESEND_FROM_MARKETING =
  Deno.env.get("RESEND_FROM_MARKETING") ||
  "ofertas@mesaclik.com.br";

function getRawEmailAddress(fromValue: string): string {
  return (fromValue || "notify@mesaclik.com.br")
    .replace(/^.*</, "")
    .replace(/>$/, "")
    .trim();
}

// ── SECURITY FLAGS ──
const REQUIRE_JWT = (Deno.env.get("REQUIRE_JWT_LOYALTY_ENROLL") ?? "true") === "true";

// ── CORS ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Resend via raw fetch (reliable in Deno edge runtime) ──
async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  from: string;
  text?: string;
}): Promise<{ id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY secret");
    return { error: "Missing RESEND_API_KEY" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text || undefined,
        reply_to: "suporte@mesaclik.com.br",
        headers: {
          "Auto-Submitted": "auto-generated",
          "X-Auto-Response-Suppress": "DR, RN, NRN, OOF, AutoReply",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", JSON.stringify(data));
      return { error: data.message || "Failed to send email" };
    }

    return { id: data.id };
  } catch (err: any) {
    console.error("Resend fetch error:", err);
    return { error: err.message || "Network error sending email" };
  }
}

// ── Auth helper ──
async function authenticateRequest(req: Request, cors: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    if (REQUIRE_JWT) {
      return { user: null, error: new Response(JSON.stringify({ error: "Autenticação necessária" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } }) };
    }
    return { user: { id: "anonymous" }, error: null };
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { user: null, error: new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } }) };
  }
  return { user: data.user, error: null };
}

// ── Ownership helper ──
async function validateOwnership(userId: string, restaurantId: string): Promise<boolean> {
  if (userId === "anonymous") return !REQUIRE_JWT;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: member } = await supabase.from("restaurant_members").select("role").eq("user_id", userId).eq("restaurant_id", restaurantId).maybeSingle();
  if (member) return true;
  const { data: admin } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!admin;
}

interface EnrollRequest {
  restaurant_id: string;
  action: "save_program" | "check_reward" | "activate_customer" | "deactivate_customer";
  customer_id?: string;
}

const VALID_ACTIONS = ["save_program", "check_reward", "activate_customer", "deactivate_customer"];

const handler = async (req: Request): Promise<Response> => {
  const cors = corsHeaders;
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // 1. Auth
    const auth = await authenticateRequest(req, cors);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    const body: EnrollRequest = await req.json();
    const { restaurant_id, action } = body;

    // 2. Input validation
    if (!restaurant_id || typeof restaurant_id !== "string") {
      return new Response(JSON.stringify({ error: "restaurant_id inválido" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "action inválida" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if ((action === "activate_customer" || action === "deactivate_customer" || action === "check_reward") && !body.customer_id) {
      return new Response(JSON.stringify({ error: "customer_id obrigatório para esta action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3. Ownership check
    if (REQUIRE_JWT && userId !== "anonymous") {
      const owns = await validateOwnership(userId, restaurant_id);
      if (!owns) {
        console.warn(`[loyalty-enroll] User ${userId} blocked — not member of ${restaurant_id}`);
        return new Response(JSON.stringify({ error: "Acesso negado a este restaurante" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: program, error: progError } = await supabase
      .from("restaurant_loyalty_program")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (progError) throw progError;
    if (!program || !program.is_active) {
      return new Response(JSON.stringify({ message: "Program not active" }), {
        status: 200, headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurant_id)
      .single();
    const restaurantName = restaurant?.name || "Restaurante";

    if (action === "activate_customer" && body.customer_id) {
      const { data: cust } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, total_queue_visits, total_reservation_visits, marketing_optin")
        .eq("id", body.customer_id)
        .eq("restaurant_id", restaurant_id)
        .single();

      if (!cust) {
        return new Response(JSON.stringify({ error: "Customer not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...cors },
        });
      }

      if (!cust.marketing_optin) {
        return new Response(JSON.stringify({ error: "Customer has not opted in to marketing" }), {
          status: 400, headers: { "Content-Type": "application/json", ...cors },
        });
      }

      await supabase.from("restaurant_customers").update({ loyalty_program_active: true }).eq("id", cust.id);

      let visits = 0;
      if (program.count_queue) visits += (cust.total_queue_visits || 0);
      if (program.count_reservations) visits += (cust.total_reservation_visits || 0);

      const rewardUnlocked = visits >= program.required_visits;
      const nowDate = new Date();
      const rewardExpiresAt = rewardUnlocked
        ? new Date(nowDate.getTime() + program.reward_validity_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: existing } = await supabase
        .from("customer_loyalty_status")
        .select("id, activation_email_sent, reward_email_sent, reward_unlocked")
        .eq("restaurant_id", restaurant_id)
        .eq("customer_id", cust.id)
        .maybeSingle();

      let emailsSent = 0;

      if (existing) {
        await supabase.from("customer_loyalty_status").update({
          current_visits: visits,
          reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked && !existing.reward_unlocked ? nowDate.toISOString() : undefined,
          reward_expires_at: rewardUnlocked ? rewardExpiresAt : null,
        }).eq("id", existing.id);

        if (!existing.activation_email_sent && cust.customer_email) {
          const visitsRemaining = Math.max(0, program.required_visits - visits);
          await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
          await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("id", existing.id);
          emailsSent++;
        }
        if (rewardUnlocked && !existing.reward_email_sent && cust.customer_email) {
          await sendRewardEmail(cust, program, restaurantName);
          await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", existing.id);
          emailsSent++;
        }
      } else {
        await supabase.from("customer_loyalty_status").insert({
          restaurant_id, customer_id: cust.id, current_visits: visits,
          reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked ? nowDate.toISOString() : null,
          reward_expires_at: rewardExpiresAt,
          activation_email_sent: false, reward_email_sent: false,
        });

        if (cust.customer_email) {
          const visitsRemaining = Math.max(0, program.required_visits - visits);
          await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
          await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
          emailsSent++;
          if (rewardUnlocked) {
            await sendRewardEmail(cust, program, restaurantName);
            await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
            emailsSent++;
          }
        }
      }

      return new Response(JSON.stringify({ success: true, visits, rewardUnlocked, emailsSent }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    if (action === "deactivate_customer" && body.customer_id) {
      await supabase.from("restaurant_customers").update({ loyalty_program_active: false }).eq("id", body.customer_id).eq("restaurant_id", restaurant_id);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

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
        const nowDate = new Date();
        const rewardExpiresAt = rewardUnlocked
          ? new Date(nowDate.getTime() + program.reward_validity_days * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const { data: existing } = await supabase
          .from("customer_loyalty_status")
          .select("id, activation_email_sent, reward_email_sent, reward_unlocked")
          .eq("restaurant_id", restaurant_id)
          .eq("customer_id", cust.id)
          .maybeSingle();

        if (existing) {
          await supabase.from("customer_loyalty_status").update({
            current_visits: visits, reward_unlocked: rewardUnlocked,
            reward_unlocked_at: rewardUnlocked && !existing.reward_unlocked ? nowDate.toISOString() : undefined,
            reward_expires_at: rewardUnlocked ? rewardExpiresAt : null,
          }).eq("id", existing.id);
          if (rewardUnlocked && !existing.reward_email_sent && cust.marketing_optin && cust.customer_email) {
            await sendRewardEmail(cust, program, restaurantName);
            await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", existing.id);
            emailsSent++;
          }
        } else {
          await supabase.from("customer_loyalty_status").insert({
            restaurant_id, customer_id: cust.id, current_visits: visits,
            reward_unlocked: rewardUnlocked,
            reward_unlocked_at: rewardUnlocked ? nowDate.toISOString() : null,
            reward_expires_at: rewardExpiresAt,
            activation_email_sent: false, reward_email_sent: false,
          });
          if (cust.marketing_optin && cust.customer_email) {
            const visitsRemaining = Math.max(0, program.required_visits - visits);
            await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
            await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
            emailsSent++;
            if (rewardUnlocked) {
              await sendRewardEmail(cust, program, restaurantName);
              await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
              emailsSent++;
            }
          }
          enrolled++;
        }
      }

      return new Response(JSON.stringify({ success: true, enrolled, emailsSent, totalCustomers: customers?.length || 0 }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    if (action === "check_reward" && body.customer_id) {
      const { data: cust } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, total_queue_visits, total_reservation_visits, marketing_optin, loyalty_program_active")
        .eq("id", body.customer_id)
        .eq("restaurant_id", restaurant_id)
        .single();

      if (!cust) {
        return new Response(JSON.stringify({ message: "Customer not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
      }
      if (!cust.loyalty_program_active) {
        return new Response(JSON.stringify({ message: "Customer not enrolled in loyalty program" }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
      }

      let visits = 0;
      if (program.count_queue) visits += (cust.total_queue_visits || 0);
      if (program.count_reservations) visits += (cust.total_reservation_visits || 0);

      const rewardUnlocked = visits >= program.required_visits;
      const nowDate = new Date();

      const { data: status } = await supabase
        .from("customer_loyalty_status")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .eq("customer_id", cust.id)
        .maybeSingle();

      if (status) {
        await supabase.from("customer_loyalty_status").update({
          current_visits: visits, reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked && !status.reward_unlocked ? nowDate.toISOString() : status.reward_unlocked_at,
          reward_expires_at: rewardUnlocked
            ? new Date(nowDate.getTime() + program.reward_validity_days * 24 * 60 * 60 * 1000).toISOString()
            : null,
        }).eq("id", status.id);
        if (rewardUnlocked && !status.reward_email_sent && cust.marketing_optin && cust.customer_email) {
          await sendRewardEmail(cust, program, restaurantName);
          await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", status.id);
        }
      } else {
        const rewardExpiresAt = rewardUnlocked
          ? new Date(nowDate.getTime() + program.reward_validity_days * 24 * 60 * 60 * 1000).toISOString()
          : null;
        await supabase.from("customer_loyalty_status").insert({
          restaurant_id, customer_id: cust.id, current_visits: visits,
          reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked ? nowDate.toISOString() : null,
          reward_expires_at: rewardExpiresAt,
        });
      }

      return new Response(JSON.stringify({ success: true, visits, rewardUnlocked }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
  } catch (error: any) {
    console.error("Error in loyalty-enroll:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

// ── Email builders (plain HTML, no gradients for Outlook compat) ──

async function sendActivationEmail(customer: any, program: any, restaurantName: string, currentVisits: number, visitsRemaining: number) {
  const fromAddress = `${restaurantName} <${RESEND_FROM_TRANSACTIONAL}>`;
  const subject = `Voce entrou no ${program.program_name} do ${restaurantName}!`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f9fafb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
        <tr><td style="padding:28px 24px;text-align:center;background-color:#ea580c;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Voce entrou no ${program.program_name}!</h1>
          <p style="margin:8px 0 0;color:#ffffff;font-size:15px;opacity:0.9;">${restaurantName}</p>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <p style="color:#374151;font-size:16px;">Ola, <strong>${customer.customer_name || 'Cliente'}</strong>!</p>
          <p style="color:#6b7280;font-size:16px;line-height:1.6;">Voce agora faz parte do <strong>${program.program_name}</strong> do <strong>${restaurantName}</strong></p>
          <p style="color:#6b7280;font-size:16px;">Funciona assim:</p>
          <ul style="color:#6b7280;font-size:15px;line-height:1.8;">
            <li>A cada visita concluida, voce acumula <strong>1 clique</strong>.</li>
            <li>Ao completar <strong>${program.required_visits} visitas</strong>, voce ganha:</li>
          </ul>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
            <tr><td style="padding:15px;background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:5px;">
              <p style="margin:0;color:#92400e;font-size:18px;font-weight:bold;">${program.reward_description}</p>
            </td></tr>
          </table>
          <p style="color:#374151;font-size:16px;">Atualmente voce ja tem <strong>${currentVisits} visitas</strong> registradas.<br>Faltam apenas <strong>${visitsRemaining}</strong> para desbloquear seu beneficio!</p>
          <p style="color:#6b7280;font-size:14px;margin-top:30px;">Esperamos voce em breve!</p>
        </td></tr>
        <tr><td style="padding:20px 24px;background-color:#f9fafb;border-radius:0 0 8px 8px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Este e-mail foi enviado pelo ${restaurantName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Voce entrou no ${program.program_name} do ${restaurantName}!\n\nOla ${customer.customer_name || 'Cliente'}!\nVoce agora faz parte do ${program.program_name}.\nA cada visita concluida, voce acumula 1 clique.\nAo completar ${program.required_visits} visitas, voce ganha: ${program.reward_description}\nAtualmente voce ja tem ${currentVisits} visitas. Faltam ${visitsRemaining}!\n\nEsperamos voce em breve!\nEquipe ${restaurantName}`;

  const result = await sendEmailViaResend({ to: customer.customer_email, subject, html, from: fromAddress, text });
  if (result.error) {
    console.error(`Failed to send activation email to ${customer.customer_email}:`, result.error);
  } else {
    console.log(`Activation email sent to ${customer.customer_email}: ${result.id}`);
  }
}

async function sendRewardEmail(customer: any, program: any, restaurantName: string) {
  const expiresDate = new Date(Date.now() + program.reward_validity_days * 24 * 60 * 60 * 1000);
  const formattedExpiry = expiresDate.toLocaleDateString("pt-BR");
  const fromAddress = `${restaurantName} <${RESEND_FROM_TRANSACTIONAL}>`;
  const subject = `Recompensa desbloqueada no ${restaurantName}!`;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f9fafb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
        <tr><td style="padding:28px 24px;text-align:center;background-color:#16a34a;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Parabens! Recompensa desbloqueada!</h1>
          <p style="margin:8px 0 0;color:#ffffff;font-size:15px;opacity:0.9;">${restaurantName}</p>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <p style="color:#374151;font-size:16px;">Ola, <strong>${customer.customer_name || 'Cliente'}</strong>!</p>
          <p style="color:#6b7280;font-size:16px;line-height:1.6;">Voce completou <strong>${program.required_visits} visitas</strong> no <strong>${restaurantName}</strong></p>
          <p style="color:#6b7280;font-size:16px;">Como prometido, voce ganhou:</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
            <tr><td style="padding:15px;background-color:#dcfce7;border-left:4px solid #16a34a;border-radius:5px;">
              <p style="margin:0;color:#166534;font-size:18px;font-weight:bold;">${program.reward_description}</p>
            </td></tr>
          </table>
          <p style="color:#374151;font-size:14px;">Valido ate: <strong>${formattedExpiry}</strong></p>
          <p style="color:#6b7280;font-size:14px;margin-top:30px;">Apresente este e-mail na sua proxima visita para resgatar seu premio!</p>
        </td></tr>
        <tr><td style="padding:20px 24px;background-color:#f9fafb;border-radius:0 0 8px 8px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Este e-mail foi enviado pelo ${restaurantName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Parabens! Recompensa desbloqueada no ${restaurantName}!\n\nOla ${customer.customer_name || 'Cliente'}!\nVoce completou ${program.required_visits} visitas.\nVoce ganhou: ${program.reward_description}\nValido ate: ${formattedExpiry}\n\nApresente este e-mail na sua proxima visita!\nEquipe ${restaurantName}`;

  const result = await sendEmailViaResend({ to: customer.customer_email, subject, html, from: fromAddress, text });
  if (result.error) {
    console.error(`Failed to send reward email to ${customer.customer_email}:`, result.error);
  } else {
    console.log(`Reward email sent to ${customer.customer_email}: ${result.id}`);
  }
}

serve(handler);

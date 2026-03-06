import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_MARKETING =
  Deno.env.get("RESEND_FROM_MARKETING") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "ofertas@mesaclik.com.br";

const FUNCTION_VERSION = "2026-03-06_v7_aligned_promotion";
const REQUIRE_JWT = (Deno.env.get("REQUIRE_JWT_LOYALTY_ENROLL") ?? "true") === "true";

// ── CORS (SAME as send-promotion-direct) ──
const ALLOWED_ORIGINS = [
  "https://mesaclik.com.br",
  "https://www.mesaclik.com.br",
  "https://app.mesaclik.com.br",
  "https://painel.mesaclik.com.br",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
];
const PREVIEW_ORIGIN_RE = /^https:\/\/.*\.lovable\.app$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    Vary: "Origin",
  };
}

// ── Resend via raw fetch (SAME as send-promotion-direct) ──
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  from: string,
  text?: string,
  headers?: Record<string, string>,
): Promise<{ id?: string; error?: string; last_event?: string }> {
  if (!RESEND_API_KEY) {
    console.error("[loyalty-enroll] CRITICAL: Missing RESEND_API_KEY secret");
    return { error: "Missing RESEND_API_KEY" };
  }

  console.log("[loyalty-enroll] Sending email via Resend:", JSON.stringify({ to, subject, from }));

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      ...(text ? { text } : {}),
      ...(headers ? { headers } : {}),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[loyalty-enroll] Resend API error:", JSON.stringify(data));
    return { error: data.message || "Failed to send email" };
  }

  const id = data?.id as string | undefined;
  let lastEvent: string | undefined;

  // Check delivery status (same as send-promotion-direct)
  if (id) {
    try {
      const statusResponse = await fetch(
        `https://api.resend.com/emails/${id}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        }
      );
      const statusJson = await statusResponse.json();
      lastEvent =
        statusJson?.data?.last_event ??
        statusJson?.data?.status ??
        statusJson?.last_event;
    } catch (e) {
      console.warn("[loyalty-enroll] Failed to fetch email status:", e);
    }
  }

  console.log("[loyalty-enroll] Email sent successfully:", JSON.stringify({ id, last_event: lastEvent }));
  return { id, last_event: lastEvent };
}

// ── Auth helper (SAME as send-promotion-direct) ──
async function authenticateRequest(req: Request, cors: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    if (REQUIRE_JWT) {
      console.warn("[loyalty-enroll] Missing JWT — blocked (REQUIRE_JWT=true)");
      return { user: null, error: new Response(JSON.stringify({ error: "Autenticação necessária" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } }) };
    }
    console.warn("[loyalty-enroll] Missing JWT — allowed (REQUIRE_JWT=false)");
    return { user: { id: "anonymous" }, error: null };
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    console.warn("[loyalty-enroll] Invalid JWT:", error?.message);
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

// ── Marketing headers (SAME as send-promotion-direct) ──
function buildMarketingHeaders(): Record<string, string> {
  return {
    "Reply-To": "suporte@mesaclik.com.br",
    Precedence: "bulk",
    "X-Auto-Response-Suppress": "DR, RN, NRN, OOF, AutoReply",
    "List-Unsubscribe": "<mailto:suporte@mesaclik.com.br?subject=unsubscribe>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

const sanitizeSubject = (subject: string): string =>
  subject
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

// ── Email builders ──
function buildActivationHtml(customer: any, program: any, restaurantName: string, currentVisits: number, visitsRemaining: number): string {
  const name = customer.customer_name || "Cliente";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Programa de Fidelidade</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);"><tr><td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Voce entrou no ${program.program_name}!</h1><p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurantName}</p></td></tr><tr><td style="padding: 32px;"><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Ola <strong>${name}</strong>!</p><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Voce agora faz parte do <strong>${program.program_name}</strong> do <strong>${restaurantName}</strong>.</p><p style="margin: 0 0 12px; color: #3f3f46; font-size: 16px;">Funciona assim:</p><ul style="color: #3f3f46; font-size: 15px; line-height: 1.8; padding-left: 20px;"><li>A cada visita concluida, voce acumula <strong>1 clique</strong>.</li><li>Ao completar <strong>${program.required_visits} visitas</strong>, voce ganha:</li></ul><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0;"><tr><td style="padding: 15px; background-color: #fff7ed; border-radius: 12px; text-align: center;"><p style="margin: 0; color: #9a3412; font-size: 18px; font-weight: bold;">${program.reward_description}</p></td></tr></table><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px;">Atualmente voce ja tem <strong>${currentVisits} visitas</strong> registradas. Faltam apenas <strong>${visitsRemaining}</strong> para desbloquear seu beneficio!</p><p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">Esperamos voce em breve!</p></td></tr><tr><td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;"><p style="margin: 0; color: #a1a1aa; font-size: 12px;">Este e-mail foi enviado pelo ${restaurantName}</p></td></tr></table></td></tr></table></body></html>`;
}

function buildRewardHtml(customer: any, program: any, restaurantName: string, formattedExpiry: string): string {
  const name = customer.customer_name || "Cliente";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Recompensa Desbloqueada</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(22, 163, 74, 0.15);"><tr><td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 16px 16px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Parabens! Recompensa desbloqueada!</h1><p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurantName}</p></td></tr><tr><td style="padding: 32px;"><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Ola <strong>${name}</strong>!</p><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Voce completou <strong>${program.required_visits} visitas</strong> no <strong>${restaurantName}</strong>!</p><p style="margin: 0 0 12px; color: #3f3f46; font-size: 16px;">Como prometido, voce ganhou:</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0;"><tr><td style="padding: 15px; background-color: #dcfce7; border-radius: 12px; text-align: center;"><p style="margin: 0; color: #166534; font-size: 18px; font-weight: bold;">${program.reward_description}</p></td></tr></table><p style="margin: 0 0 20px; color: #3f3f46; font-size: 14px;">Valido ate: <strong>${formattedExpiry}</strong></p><p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">Apresente este e-mail na sua proxima visita para resgatar seu premio!</p></td></tr><tr><td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;"><p style="margin: 0; color: #a1a1aa; font-size: 12px;">Este e-mail foi enviado pelo ${restaurantName}</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendActivationEmail(customer: any, program: any, restaurantName: string, currentVisits: number, visitsRemaining: number): Promise<boolean> {
  const fromAddress = `Ofertas MesaClik <${RESEND_FROM_MARKETING}>`;
  const subject = sanitizeSubject(`Voce entrou no ${program.program_name} - ${restaurantName}`);
  const html = buildActivationHtml(customer, program, restaurantName, currentVisits, visitsRemaining);
  const text = `Voce entrou no ${program.program_name} do ${restaurantName}!\n\nOla ${customer.customer_name || "Cliente"}!\nVoce agora faz parte do ${program.program_name}.\nA cada visita concluida, voce acumula 1 clique.\nAo completar ${program.required_visits} visitas, voce ganha: ${program.reward_description}\nAtualmente voce ja tem ${currentVisits} visitas. Faltam ${visitsRemaining}!\n\nEsperamos voce em breve!\nEquipe ${restaurantName}`;

  console.log("[loyalty-enroll] Sending ACTIVATION email:", JSON.stringify({
    to: customer.customer_email,
    from: fromAddress,
    subject,
    customer_id: customer.id,
  }));

  const result = await sendEmailViaResend(customer.customer_email, subject, html, fromAddress, text, buildMarketingHeaders());

  if (result.error) {
    console.error("[loyalty-enroll] ACTIVATION email FAILED:", JSON.stringify({ error: result.error, to: customer.customer_email }));
    return false;
  }

  console.log("[loyalty-enroll] ACTIVATION email SUCCESS:", JSON.stringify({ id: result.id, last_event: result.last_event }));
  return true;
}

async function sendRewardEmail(customer: any, program: any, restaurantName: string): Promise<boolean> {
  const expiresDate = new Date(Date.now() + program.reward_validity_days * 24 * 60 * 60 * 1000);
  const formattedExpiry = expiresDate.toLocaleDateString("pt-BR");
  const fromAddress = `Ofertas MesaClik <${RESEND_FROM_MARKETING}>`;
  const subject = sanitizeSubject(`Recompensa desbloqueada - ${restaurantName}`);
  const html = buildRewardHtml(customer, program, restaurantName, formattedExpiry);
  const text = `Parabens! Recompensa desbloqueada no ${restaurantName}!\n\nOla ${customer.customer_name || "Cliente"}!\nVoce completou ${program.required_visits} visitas.\nVoce ganhou: ${program.reward_description}\nValido ate: ${formattedExpiry}\n\nApresente este e-mail na sua proxima visita!\nEquipe ${restaurantName}`;

  console.log("[loyalty-enroll] Sending REWARD email:", JSON.stringify({
    to: customer.customer_email,
    from: fromAddress,
    subject,
    customer_id: customer.id,
  }));

  const result = await sendEmailViaResend(customer.customer_email, subject, html, fromAddress, text, buildMarketingHeaders());

  if (result.error) {
    console.error("[loyalty-enroll] REWARD email FAILED:", JSON.stringify({ error: result.error, to: customer.customer_email }));
    return false;
  }

  console.log("[loyalty-enroll] REWARD email SUCCESS:", JSON.stringify({ id: result.id, last_event: result.last_event }));
  return true;
}

// ── Main handler ──
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const auth = await authenticateRequest(req, corsHeaders);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    const body: EnrollRequest = await req.json();
    const { restaurant_id, action } = body;

    console.log("[loyalty-enroll] version:", FUNCTION_VERSION, "invoked:", JSON.stringify({ action, restaurant_id, customer_id: body.customer_id, userId }));

    // 2. Input validation
    if (!restaurant_id || typeof restaurant_id !== "string") {
      return new Response(JSON.stringify({ error: "restaurant_id invalido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: "action invalida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if ((action === "activate_customer" || action === "deactivate_customer" || action === "check_reward") && !body.customer_id) {
      return new Response(JSON.stringify({ error: "customer_id obrigatorio para esta action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Ownership check
    if (REQUIRE_JWT && userId !== "anonymous") {
      const owns = await validateOwnership(userId, restaurant_id);
      if (!owns) {
        console.warn(`[loyalty-enroll] User ${userId} blocked — not member of ${restaurant_id}`);
        return new Response(JSON.stringify({ error: "Acesso negado a este restaurante" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: program, error: progError } = await supabase
      .from("restaurant_loyalty_program")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (progError) {
      console.error("[loyalty-enroll] Error fetching program:", progError);
      throw progError;
    }
    if (!program || !program.is_active) {
      console.log("[loyalty-enroll] Program not active for restaurant:", restaurant_id);
      return new Response(JSON.stringify({ message: "Program not active" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: restaurant } = await supabase.from("restaurants").select("name").eq("id", restaurant_id).single();
    const restaurantName = restaurant?.name || "Restaurante";

    console.log("[loyalty-enroll] Program found:", JSON.stringify({ program_name: program.program_name, required_visits: program.required_visits, restaurant: restaurantName }));

    // ── ACTIVATE CUSTOMER ──
    if (action === "activate_customer" && body.customer_id) {
      console.log("[loyalty-enroll] activate_customer for:", body.customer_id);

      const { data: cust, error: custError } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, total_queue_visits, total_reservation_visits, marketing_optin")
        .eq("id", body.customer_id)
        .eq("restaurant_id", restaurant_id)
        .single();

      if (custError || !cust) {
        console.error("[loyalty-enroll] Customer not found:", body.customer_id, custError?.message);
        return new Response(JSON.stringify({ error: "Customer not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      console.log("[loyalty-enroll] Customer data:", JSON.stringify({
        id: cust.id,
        email: cust.customer_email,
        marketing_optin: cust.marketing_optin,
        queue_visits: cust.total_queue_visits,
        reservation_visits: cust.total_reservation_visits,
      }));

      if (!cust.marketing_optin) {
        console.warn("[loyalty-enroll] Customer has NOT opted in to marketing:", cust.id);
        return new Response(JSON.stringify({ error: "Customer has not opted in to marketing" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
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

      console.log("[loyalty-enroll] Visits calculated:", JSON.stringify({ visits, rewardUnlocked, required: program.required_visits }));

      const { data: existing } = await supabase
        .from("customer_loyalty_status")
        .select("id, activation_email_sent, reward_email_sent, reward_unlocked")
        .eq("restaurant_id", restaurant_id)
        .eq("customer_id", cust.id)
        .maybeSingle();

      let emailsSent = 0;

      if (existing) {
        console.log("[loyalty-enroll] Existing status found:", JSON.stringify({ id: existing.id, activation_sent: existing.activation_email_sent, reward_sent: existing.reward_email_sent }));

        await supabase.from("customer_loyalty_status").update({
          current_visits: visits,
          reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked && !existing.reward_unlocked ? nowDate.toISOString() : undefined,
          reward_expires_at: rewardUnlocked ? rewardExpiresAt : null,
        }).eq("id", existing.id);

        if (!existing.activation_email_sent && cust.customer_email) {
          const visitsRemaining = Math.max(0, program.required_visits - visits);
          const sent = await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
          if (sent) {
            await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("id", existing.id);
            emailsSent++;
          }
        } else {
          console.log("[loyalty-enroll] Skipping activation email:", existing.activation_email_sent ? "already sent" : "no email address");
        }

        if (rewardUnlocked && !existing.reward_email_sent && cust.customer_email) {
          const sent = await sendRewardEmail(cust, program, restaurantName);
          if (sent) {
            await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", existing.id);
            emailsSent++;
          }
        }
      } else {
        console.log("[loyalty-enroll] No existing status — creating new entry");

        await supabase.from("customer_loyalty_status").insert({
          restaurant_id, customer_id: cust.id, current_visits: visits,
          reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked ? nowDate.toISOString() : null,
          reward_expires_at: rewardExpiresAt,
          activation_email_sent: false, reward_email_sent: false,
        });

        if (cust.customer_email) {
          const visitsRemaining = Math.max(0, program.required_visits - visits);
          const sent = await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
          if (sent) {
            await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
            emailsSent++;
          }
          if (rewardUnlocked) {
            const rewardSent = await sendRewardEmail(cust, program, restaurantName);
            if (rewardSent) {
              await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
              emailsSent++;
            }
          }
        } else {
          console.warn("[loyalty-enroll] Customer has no email address — skipping all emails");
        }
      }

      console.log("[loyalty-enroll] activate_customer DONE:", JSON.stringify({ visits, rewardUnlocked, emailsSent }));
      return new Response(JSON.stringify({ success: true, visits, rewardUnlocked, emailsSent }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // ── DEACTIVATE CUSTOMER ──
    if (action === "deactivate_customer" && body.customer_id) {
      console.log("[loyalty-enroll] deactivate_customer:", body.customer_id);
      await supabase.from("restaurant_customers").update({ loyalty_program_active: false }).eq("id", body.customer_id).eq("restaurant_id", restaurant_id);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // ── SAVE PROGRAM ──
    if (action === "save_program") {
      console.log("[loyalty-enroll] save_program — fetching all customers for restaurant:", restaurant_id);

      const { data: customers, error: custListError } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, total_queue_visits, total_reservation_visits, marketing_optin")
        .eq("restaurant_id", restaurant_id);

      if (custListError) {
        console.error("[loyalty-enroll] Error fetching customers:", custListError);
        throw custListError;
      }

      console.log("[loyalty-enroll] Found", customers?.length || 0, "customers");

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
            const sent = await sendRewardEmail(cust, program, restaurantName);
            if (sent) {
              await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", existing.id);
              emailsSent++;
            }
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
            const sent = await sendActivationEmail(cust, program, restaurantName, visits, visitsRemaining);
            if (sent) {
              await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
              emailsSent++;
            }
            if (rewardUnlocked) {
              const rewardSent = await sendRewardEmail(cust, program, restaurantName);
              if (rewardSent) {
                await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
                emailsSent++;
              }
            }
          }
          enrolled++;
        }
      }

      console.log("[loyalty-enroll] save_program DONE:", JSON.stringify({ enrolled, emailsSent, totalCustomers: customers?.length || 0 }));
      return new Response(JSON.stringify({ success: true, enrolled, emailsSent, totalCustomers: customers?.length || 0 }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // ── CHECK REWARD ──
    if (action === "check_reward" && body.customer_id) {
      console.log("[loyalty-enroll] check_reward for:", body.customer_id);

      const { data: cust } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, total_queue_visits, total_reservation_visits, marketing_optin, loyalty_program_active")
        .eq("id", body.customer_id)
        .eq("restaurant_id", restaurant_id)
        .single();

      if (!cust) {
        return new Response(JSON.stringify({ message: "Customer not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      if (!cust.loyalty_program_active) {
        return new Response(JSON.stringify({ message: "Customer not enrolled" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
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
          const sent = await sendRewardEmail(cust, program, restaurantName);
          if (sent) {
            await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", status.id);
          }
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

      console.log("[loyalty-enroll] check_reward DONE:", JSON.stringify({ visits, rewardUnlocked }));
      return new Response(JSON.stringify({ success: true, visits, rewardUnlocked }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("[loyalty-enroll] UNHANDLED ERROR:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

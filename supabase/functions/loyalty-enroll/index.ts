import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_MARKETING =
  Deno.env.get("RESEND_FROM_MARKETING") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "ofertas@mesaclik.com.br";

const FUNCTION_VERSION = "2026-04-02_v10_sms_fix";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("VITE_PUBLIC_APP_URL");
const TRACKING_BASE_URL = Deno.env.get("LOYALTY_TRACKING_URL") || (PUBLIC_APP_URL ? `${PUBLIC_APP_URL.replace(/\/$/, "")}/clube` : "https://mesaclik.com.br/clube");
const REQUIRE_JWT = (Deno.env.get("REQUIRE_JWT_LOYALTY_ENROLL") ?? "true") === "true";

// ── CORS ──
const ALLOWED_ORIGINS = [
  "https://mesaclik.com.br",
  "https://www.mesaclik.com.br",
  "https://app.mesaclik.com.br",
  "https://painel.mesaclik.com.br",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
];
const PREVIEW_ORIGIN_RE = /^https:\/\/.*\.(lovable\.app|lovableproject\.com)$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ── Resend via raw fetch ──
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

  if (id) {
    try {
      const statusResponse = await fetch(
        `https://api.resend.com/emails/${id}`,
        { method: "GET", headers: { Authorization: `Bearer ${RESEND_API_KEY}` } }
      );
      const statusJson = await statusResponse.json();
      lastEvent = statusJson?.data?.last_event ?? statusJson?.data?.status ?? statusJson?.last_event;
    } catch (e) {
      console.warn("[loyalty-enroll] Failed to fetch email status:", e);
    }
  }

  console.log("[loyalty-enroll] Email sent successfully:", JSON.stringify({ id, last_event: lastEvent }));
  return { id, last_event: lastEvent };
}

// ── SMS + WhatsApp via Twilio ──
function normalizePhoneForTwilio(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const rawPhone = String(phone).trim();
  if (!rawPhone) return null;

  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 10) return null;

  if (rawPhone.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;

  return `+55${digits}`;
}

async function sendTwilioMessage(
  to: string,
  body: string,
  channel: 'sms' | 'whatsapp'
): Promise<{ success: boolean; sid?: string; channel: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
  const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "+14155238886";

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_PHONE_NUMBER) {
    return { success: false, channel };
  }

  const formattedPhone = normalizePhoneForTwilio(to);
  if (!formattedPhone) {
    console.warn(`[loyalty-enroll] ${channel} skipped: invalid phone`, to);
    return { success: false, channel };
  }

  const formattedTo = channel === 'whatsapp' ? `whatsapp:${formattedPhone}` : formattedPhone;
  const formattedFrom = channel === 'whatsapp' ? `whatsapp:${TWILIO_WHATSAPP_NUMBER}` : TWILIO_PHONE_NUMBER;

  try {
    const response = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: formattedTo, From: formattedFrom, Body: body }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.warn(`[loyalty-enroll] ${channel} failed:`, data.message || JSON.stringify(data));
      return { success: false, channel };
    }
    console.log(`[loyalty-enroll] ${channel} sent:`, data.sid);
    return { success: true, sid: data.sid, channel };
  } catch (err) {
    console.warn(`[loyalty-enroll] ${channel} error:`, err);
    return { success: false, channel };
  }
}

async function sendSmsAndWhatsApp(phone: string | null, body: string): Promise<{ smsSent: boolean; whatsappSent: boolean }> {
  if (!phone) {
    console.warn("[loyalty-enroll] SMS/WhatsApp skipped: customer without phone");
    return { smsSent: false, whatsappSent: false };
  }

  const formattedPhone = normalizePhoneForTwilio(phone);
  if (!formattedPhone) {
    console.warn("[loyalty-enroll] SMS/WhatsApp skipped: invalid phone", phone);
    return { smsSent: false, whatsappSent: false };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const functionsBaseUrl = supabaseUrl?.replace(".supabase.co", ".functions.supabase.co");

  if (functionsBaseUrl && supabaseAnonKey) {
    try {
      const bridgeResponse = await fetch(`${functionsBaseUrl}/send-sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({
          to: formattedPhone,
          message: body,
        }),
      });

      const bridgeData = await bridgeResponse.json().catch(() => ({}));

      if (bridgeResponse.ok && bridgeData?.success) {
        const smsSent = !!bridgeData?.sms?.success;
        const whatsappSent = !!bridgeData?.whatsapp?.success;

        console.log("[loyalty-enroll] send-sms bridge success:", JSON.stringify({ smsSent, whatsappSent }));
        return { smsSent, whatsappSent };
      }

      console.warn("[loyalty-enroll] send-sms bridge failed, falling back to direct Twilio:", JSON.stringify(bridgeData));
    } catch (bridgeError) {
      console.warn("[loyalty-enroll] send-sms bridge error, falling back to direct Twilio:", bridgeError);
    }
  }

  const [smsResult, whatsappResult] = await Promise.all([
    sendTwilioMessage(phone, body, 'sms'),
    sendTwilioMessage(phone, body, 'whatsapp'),
  ]);

  console.log("[loyalty-enroll] Channel results:", JSON.stringify({
    smsSent: smsResult.success,
    whatsappSent: whatsappResult.success,
  }));

  return {
    smsSent: smsResult.success,
    whatsappSent: whatsappResult.success,
  };
}


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

// ── Marketing headers ──
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
  subject.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim().slice(0, 120);

// ── Helper: get effective values (per-customer override or program default) ──
function getEffectiveValues(statusRow: any, program: any) {
  return {
    requiredVisits: statusRow?.custom_required_visits ?? program.required_visits,
    rewardDescription: statusRow?.custom_reward_description ?? program.reward_description,
    rewardValidityDays: statusRow?.custom_reward_validity_days ?? program.reward_validity_days,
  };
}

// ── Email builders ──
function buildActivationHtml(customer: any, programName: string, restaurantName: string, requiredVisits: number, rewardDescription: string, currentVisits: number, visitsRemaining: number, trackingUrl?: string): string {
  const name = customer.customer_name || "Cliente";
  const trackingButton = trackingUrl ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;"><tr><td align="center"><a href="${trackingUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">Ver meu programa</a></td></tr></table>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Programa de Fidelidade</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);"><tr><td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Voce entrou no ${programName}!</h1><p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurantName}</p></td></tr><tr><td style="padding: 32px;"><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Ola <strong>${name}</strong>!</p><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Voce agora faz parte do <strong>${programName}</strong> do <strong>${restaurantName}</strong>.</p><p style="margin: 0 0 12px; color: #3f3f46; font-size: 16px;">Funciona assim:</p><ul style="color: #3f3f46; font-size: 15px; line-height: 1.8; padding-left: 20px;"><li>A cada visita concluida, voce acumula <strong>1 clique</strong>.</li><li>Ao completar <strong>${requiredVisits} visitas</strong>, voce ganha:</li></ul><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0;"><tr><td style="padding: 15px; background-color: #fff7ed; border-radius: 12px; text-align: center;"><p style="margin: 0; color: #9a3412; font-size: 18px; font-weight: bold;">${rewardDescription}</p></td></tr></table><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px;">Atualmente voce ja tem <strong>${currentVisits} visitas</strong> registradas. Faltam apenas <strong>${visitsRemaining}</strong> para desbloquear seu beneficio!</p>${trackingButton}<p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">Esperamos voce em breve!</p></td></tr><tr><td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;"><p style="margin: 0; color: #a1a1aa; font-size: 12px;">Este e-mail foi enviado pelo ${restaurantName}</p></td></tr></table></td></tr></table></body></html>`;
}

function buildRewardHtml(customer: any, programName: string, restaurantName: string, rewardDescription: string, formattedExpiry: string, requiredVisits: number, trackingUrl?: string): string {
  const name = customer.customer_name || "Cliente";
  const trackingButton = trackingUrl ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;"><tr><td align="center"><a href="${trackingUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">Ver meu programa</a></td></tr></table>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Recompensa Desbloqueada</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(22, 163, 74, 0.15);"><tr><td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 16px 16px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Parabens! Recompensa desbloqueada!</h1><p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurantName}</p></td></tr><tr><td style="padding: 32px;"><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Ola <strong>${name}</strong>!</p><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Voce completou <strong>${requiredVisits} visitas</strong> no <strong>${restaurantName}</strong>!</p><p style="margin: 0 0 12px; color: #3f3f46; font-size: 16px;">Como prometido, voce ganhou:</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0;"><tr><td style="padding: 15px; background-color: #dcfce7; border-radius: 12px; text-align: center;"><p style="margin: 0; color: #166534; font-size: 18px; font-weight: bold;">${rewardDescription}</p></td></tr></table><p style="margin: 0 0 20px; color: #3f3f46; font-size: 14px;">Valido ate: <strong>${formattedExpiry}</strong></p>${trackingButton}<p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">Apresente este e-mail na sua proxima visita para resgatar seu premio!</p></td></tr><tr><td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;"><p style="margin: 0; color: #a1a1aa; font-size: 12px;">Este e-mail foi enviado pelo ${restaurantName}</p></td></tr></table></td></tr></table></body></html>`;
}

function buildReminderHtml(customer: any, programName: string, restaurantName: string, rewardDescription: string, currentVisits: number, requiredVisits: number, remaining: number, trackingUrl?: string): string {
  const name = customer.customer_name || "Cliente";
  const urgencyColor = remaining <= 2 ? "#dc2626" : remaining <= 3 ? "#f97316" : "#eab308";
  const urgencyBg = remaining <= 2 ? "#fef2f2" : remaining <= 3 ? "#fff7ed" : "#fefce8";
  const trackingButton = trackingUrl ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0;"><tr><td align="center"><a href="${trackingUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">Ver meu programa</a></td></tr></table>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Faltam ${remaining} visitas!</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.12);"><tr><td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Faltam apenas ${remaining} visitas!</h1><p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurantName}</p></td></tr><tr><td style="padding: 32px;"><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Ola <strong>${name}</strong>!</p><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Voce esta quase la! Ja acumulou <strong>${currentVisits} de ${requiredVisits} visitas</strong> no <strong>${programName}</strong>.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0;"><tr><td style="padding: 20px; background-color: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; border-radius: 8px;"><p style="margin: 0 0 8px; color: ${urgencyColor}; font-size: 24px; font-weight: bold; text-align: center;">Faltam ${remaining}!</p><p style="margin: 0; color: #3f3f46; font-size: 14px; text-align: center;">Visite o <strong>${restaurantName}</strong> e acumule mais cliques</p></td></tr></table><p style="margin: 20px 0 8px; color: #3f3f46; font-size: 15px;">Sua recompensa ao completar:</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 8px 0 20px;"><tr><td style="padding: 15px; background-color: #fff7ed; border-radius: 12px; text-align: center;"><p style="margin: 0; color: #9a3412; font-size: 18px; font-weight: bold;">${rewardDescription}</p></td></tr></table>${trackingButton}<p style="margin: 0; color: #71717a; font-size: 14px; text-align: center;">Nos vemos em breve!</p></td></tr><tr><td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;"><p style="margin: 0; color: #a1a1aa; font-size: 12px;">Este e-mail foi enviado pelo ${restaurantName}</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendActivationEmail(customer: any, programName: string, restaurantName: string, requiredVisits: number, rewardDescription: string, currentVisits: number, visitsRemaining: number, trackingUrl?: string): Promise<boolean> {
  const fromAddress = `Ofertas MesaClik <${RESEND_FROM_MARKETING}>`;
  const subject = sanitizeSubject(`Voce entrou no ${programName} - ${restaurantName}`);
  const html = buildActivationHtml(customer, programName, restaurantName, requiredVisits, rewardDescription, currentVisits, visitsRemaining, trackingUrl);
  const text = `Voce entrou no ${programName} do ${restaurantName}!\n\nOla ${customer.customer_name || "Cliente"}!\nA cada visita concluida, voce acumula 1 clique.\nAo completar ${requiredVisits} visitas, voce ganha: ${rewardDescription}\nAtualmente voce ja tem ${currentVisits} visitas. Faltam ${visitsRemaining}!\n\n${trackingUrl ? `Acompanhe seu progresso: ${trackingUrl}\n\n` : ''}Esperamos voce em breve!\nEquipe ${restaurantName}`;

  // SMS + WhatsApp
  const smsText = `${restaurantName}: Voce entrou no ${programName}! Complete ${requiredVisits} visitas e ganhe: ${rewardDescription}. Voce ja tem ${currentVisits}. Faltam ${visitsRemaining}!${trackingUrl ? ` Acompanhe: ${trackingUrl}` : ''}`;

  const smsPromise = sendSmsAndWhatsApp(customer.customer_phone, smsText);
  const emailPromise = customer.customer_email
    ? (() => {
        console.log("[loyalty-enroll] Sending ACTIVATION email:", JSON.stringify({ to: customer.customer_email, from: fromAddress, subject }));
        return sendEmailViaResend(customer.customer_email, subject, html, fromAddress, text, buildMarketingHeaders());
      })()
    : Promise.resolve<{ id?: string; error?: string; last_event?: string }>({});

  const [channelResult, result] = await Promise.all([smsPromise, emailPromise]);

  if (customer.customer_email && result.error) {
    console.error("[loyalty-enroll] ACTIVATION email FAILED:", JSON.stringify({ error: result.error, to: customer.customer_email }));
  } else if (customer.customer_email) {
    console.log("[loyalty-enroll] ACTIVATION email SUCCESS:", JSON.stringify({ id: result.id, last_event: result.last_event }));
  } else {
    console.log("[loyalty-enroll] ACTIVATION email skipped: customer without email");
  }

  const notificationSent = !!result.id || channelResult.smsSent || channelResult.whatsappSent;
  if (!notificationSent) {
    console.warn("[loyalty-enroll] ACTIVATION notification failed on all channels", JSON.stringify({ customer_id: customer.id }));
  }

  return notificationSent;
}

async function sendRewardEmail(customer: any, programName: string, restaurantName: string, requiredVisits: number, rewardDescription: string, rewardValidityDays: number, trackingUrl?: string): Promise<boolean> {
  const expiresDate = new Date(Date.now() + rewardValidityDays * 24 * 60 * 60 * 1000);
  const formattedExpiry = expiresDate.toLocaleDateString("pt-BR");
  const fromAddress = `Ofertas MesaClik <${RESEND_FROM_MARKETING}>`;
  const subject = sanitizeSubject(`Recompensa desbloqueada - ${restaurantName}`);
  const html = buildRewardHtml(customer, programName, restaurantName, rewardDescription, formattedExpiry, requiredVisits, trackingUrl);
  const text = `Parabens! Recompensa desbloqueada no ${restaurantName}!\n\nVoce completou ${requiredVisits} visitas.\nVoce ganhou: ${rewardDescription}\nValido ate: ${formattedExpiry}\n\n${trackingUrl ? `Veja seu programa: ${trackingUrl}\n\n` : ''}Apresente este e-mail na sua proxima visita!\nEquipe ${restaurantName}`;

  // SMS + WhatsApp
  const smsText = `${restaurantName}: Parabens! Voce completou ${requiredVisits} visitas e ganhou: ${rewardDescription}. Valido ate ${formattedExpiry}.${trackingUrl ? ` Veja: ${trackingUrl}` : ''} Apresente esta mensagem na sua proxima visita!`;

  const smsPromise = sendSmsAndWhatsApp(customer.customer_phone, smsText);
  const emailPromise = customer.customer_email
    ? (() => {
        console.log("[loyalty-enroll] Sending REWARD email:", JSON.stringify({ to: customer.customer_email, from: fromAddress, subject }));
        return sendEmailViaResend(customer.customer_email, subject, html, fromAddress, text, buildMarketingHeaders());
      })()
    : Promise.resolve<{ id?: string; error?: string; last_event?: string }>({});

  const [channelResult, result] = await Promise.all([smsPromise, emailPromise]);

  if (customer.customer_email && result.error) {
    console.error("[loyalty-enroll] REWARD email FAILED:", JSON.stringify({ error: result.error, to: customer.customer_email }));
  } else if (customer.customer_email) {
    console.log("[loyalty-enroll] REWARD email SUCCESS:", JSON.stringify({ id: result.id, last_event: result.last_event }));
  } else {
    console.log("[loyalty-enroll] REWARD email skipped: customer without email");
  }

  const notificationSent = !!result.id || channelResult.smsSent || channelResult.whatsappSent;
  if (!notificationSent) {
    console.warn("[loyalty-enroll] REWARD notification failed on all channels", JSON.stringify({ customer_id: customer.id }));
  }

  return notificationSent;
}

async function sendReminderEmail(customer: any, programName: string, restaurantName: string, rewardDescription: string, currentVisits: number, requiredVisits: number, remaining: number, trackingUrl?: string): Promise<boolean> {
  const fromAddress = `Ofertas MesaClik <${RESEND_FROM_MARKETING}>`;
  const subject = sanitizeSubject(`Faltam ${remaining} visitas para sua recompensa - ${restaurantName}`);
  const html = buildReminderHtml(customer, programName, restaurantName, rewardDescription, currentVisits, requiredVisits, remaining, trackingUrl);
  const text = `Faltam apenas ${remaining} visitas!\n\nOla ${customer.customer_name || "Cliente"}!\nVoce ja tem ${currentVisits} de ${requiredVisits} visitas no ${programName} do ${restaurantName}.\nSua recompensa: ${rewardDescription}\n\n${trackingUrl ? `Acompanhe: ${trackingUrl}\n\n` : ''}Nos vemos em breve!\nEquipe ${restaurantName}`;

  // SMS + WhatsApp
  const smsText = `${restaurantName}: Faltam apenas ${remaining} visitas para sua recompensa: ${rewardDescription}. Voce ja tem ${currentVisits} de ${requiredVisits}!${trackingUrl ? ` Acompanhe: ${trackingUrl}` : ''}`;

  const smsPromise = sendSmsAndWhatsApp(customer.customer_phone, smsText);
  const emailPromise = customer.customer_email
    ? (() => {
        console.log("[loyalty-enroll] Sending REMINDER email:", JSON.stringify({ to: customer.customer_email, remaining }));
        return sendEmailViaResend(customer.customer_email, subject, html, fromAddress, text, buildMarketingHeaders());
      })()
    : Promise.resolve<{ id?: string; error?: string; last_event?: string }>({});

  const [channelResult, result] = await Promise.all([smsPromise, emailPromise]);

  if (customer.customer_email && result.error) {
    console.error("[loyalty-enroll] REMINDER email FAILED:", JSON.stringify({ error: result.error }));
  } else if (customer.customer_email) {
    console.log("[loyalty-enroll] REMINDER email SUCCESS:", JSON.stringify({ id: result.id }));
  } else {
    console.log("[loyalty-enroll] REMINDER email skipped: customer without email");
  }

  const notificationSent = !!result.id || channelResult.smsSent || channelResult.whatsappSent;
  if (!notificationSent) {
    console.warn("[loyalty-enroll] REMINDER notification failed on all channels", JSON.stringify({ customer_id: customer.id, remaining }));
  }

  return notificationSent;
}

// ── Send reminder emails based on remaining visits (2-5) ──
async function processReminders(supabase: any, statusRow: any, customer: any, programName: string, restaurantName: string, requiredVisits: number, rewardDescription: string, currentVisits: number): Promise<number> {
  if (!customer.marketing_optin || (!customer.customer_email && !customer.customer_phone)) return 0;

  const remaining = requiredVisits - currentVisits;
  if (remaining < 2 || remaining > 5) return 0;

  // Build tracking URL from token
  const trackingUrl = statusRow?.loyalty_token ? `${TRACKING_BASE_URL}/${statusRow.loyalty_token}` : undefined;

  let emailsSent = 0;
  const reminderField = `reminder_${remaining}_sent`;
  const alreadySent = statusRow?.[reminderField] === true;

  if (!alreadySent) {
    const sent = await sendReminderEmail(customer, programName, restaurantName, rewardDescription, currentVisits, requiredVisits, remaining, trackingUrl);
    if (sent) {
      await supabase.from("customer_loyalty_status").update({ [reminderField]: true }).eq("id", statusRow.id);
      emailsSent++;
      console.log(`[loyalty-enroll] Reminder ${remaining} sent for customer ${customer.id}`);
    }
  }

  return emailsSent;
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

    let { data: program, error: progError } = await supabase
      .from("restaurant_loyalty_program")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (progError) {
      console.error("[loyalty-enroll] Error fetching program:", progError);
      throw progError;
    }

    // Auto-create program if it doesn't exist (since config is now per-customer)
    if (!program) {
      console.log("[loyalty-enroll] Auto-creating loyalty program for restaurant:", restaurant_id);
      const { data: newProg, error: createErr } = await supabase
        .from("restaurant_loyalty_program")
        .upsert({
          restaurant_id: restaurant_id,
          is_active: true,
          program_name: "Clube MesaClik",
          required_visits: 10,
          count_queue: true,
          count_reservations: true,
          reward_description: "Recompensa especial",
          reward_validity_days: 30,
        }, { onConflict: "restaurant_id" })
        .select("*")
        .single();

      if (createErr || !newProg) {
        console.error("[loyalty-enroll] Error auto-creating program:", createErr);
        return new Response(JSON.stringify({ error: "Failed to create loyalty program" }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      program = newProg;
    } else if (!program.is_active) {
      // Activate if exists but inactive
      await supabase.from("restaurant_loyalty_program").update({ is_active: true }).eq("restaurant_id", restaurant_id);
      program.is_active = true;
    }

    const { data: restaurant } = await supabase.from("restaurants").select("name").eq("id", restaurant_id).single();
    const restaurantName = restaurant?.name || "Restaurante";

    console.log("[loyalty-enroll] Program found:", JSON.stringify({ program_name: program.program_name, required_visits: program.required_visits, restaurant: restaurantName }));

    // ── ACTIVATE CUSTOMER ──
    if (action === "activate_customer" && body.customer_id) {
      console.log("[loyalty-enroll] activate_customer for:", body.customer_id);

      const { data: cust, error: custError } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, customer_phone, total_manual_visits, total_queue_visits, total_reservation_visits, marketing_optin")
        .eq("id", body.customer_id)
        .eq("restaurant_id", restaurant_id)
        .single();

      if (custError || !cust) {
        console.error("[loyalty-enroll] Customer not found:", body.customer_id, custError?.message);
        return new Response(JSON.stringify({ error: "Customer not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      if (!cust.marketing_optin) {
        console.warn("[loyalty-enroll] Customer has NOT opted in to marketing:", cust.id);
        return new Response(JSON.stringify({ error: "Customer has not opted in to marketing" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      await supabase.from("restaurant_customers").update({ loyalty_program_active: true }).eq("id", cust.id);

      // Always start at 0 visits on activation
      const visits = 0;

      // Accept per-customer config from the request body
      const customRequiredVisits = body.custom_required_visits ?? null;
      const customRewardDescription = body.custom_reward_description ?? null;
      const customRewardValidityDays = body.custom_reward_validity_days ?? null;

      // Check for existing status
      const { data: existing } = await supabase
        .from("customer_loyalty_status")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .eq("customer_id", cust.id)
        .maybeSingle();

      // Build effective values using request body overrides
      const effectiveOverride = {
        custom_required_visits: customRequiredVisits,
        custom_reward_description: customRewardDescription,
        custom_reward_validity_days: customRewardValidityDays,
      };
      const effective = getEffectiveValues(existing ?? effectiveOverride, program);
      const rewardUnlocked = false; // Always false since visits = 0
      const nowDate = new Date();
      const rewardExpiresAt = rewardUnlocked
        ? new Date(nowDate.getTime() + effective.rewardValidityDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      console.log("[loyalty-enroll] Visits calculated:", JSON.stringify({ visits, rewardUnlocked, required: effective.requiredVisits }));

      let emailsSent = 0;

      if (existing) {
        await supabase.from("customer_loyalty_status").update({
          current_visits: 0,
          reward_unlocked: false,
          reward_unlocked_at: null,
          reward_expires_at: null,
          custom_required_visits: customRequiredVisits ?? existing.custom_required_visits,
          custom_reward_description: customRewardDescription ?? existing.custom_reward_description,
          custom_reward_validity_days: customRewardValidityDays ?? existing.custom_reward_validity_days,
        }).eq("id", existing.id);

        const trackingUrl = existing.loyalty_token ? `${TRACKING_BASE_URL}/${existing.loyalty_token}` : undefined;

        if (!existing.activation_email_sent && (cust.customer_email || cust.customer_phone)) {
          const visitsRemaining = Math.max(0, effective.requiredVisits - visits);
          const sent = await sendActivationEmail(cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, visits, visitsRemaining, trackingUrl);
          if (sent) {
            await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("id", existing.id);
            emailsSent++;
          }
        }

        if (rewardUnlocked && !existing.reward_email_sent && (cust.customer_email || cust.customer_phone)) {
          const sent = await sendRewardEmail(cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, effective.rewardValidityDays, trackingUrl);
          if (sent) {
            await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", existing.id);
            emailsSent++;
          }
        }

        // Process reminders
        if (!rewardUnlocked) {
          emailsSent += await processReminders(supabase, existing, cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, visits);
        }
      } else {
        const { data: newStatus } = await supabase.from("customer_loyalty_status").insert({
          restaurant_id, customer_id: cust.id, current_visits: 0,
          reward_unlocked: false,
          reward_unlocked_at: null,
          reward_expires_at: null,
          activation_email_sent: false, reward_email_sent: false,
          custom_required_visits: customRequiredVisits,
          custom_reward_description: customRewardDescription,
          custom_reward_validity_days: customRewardValidityDays,
        }).select("*").single();

        const trackingUrl = newStatus?.loyalty_token ? `${TRACKING_BASE_URL}/${newStatus.loyalty_token}` : undefined;

        if (cust.customer_email || cust.customer_phone) {
          const visitsRemaining = Math.max(0, effective.requiredVisits - visits);
          const sent = await sendActivationEmail(cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, visits, visitsRemaining, trackingUrl);
          if (sent) {
            await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
            emailsSent++;
          }
          if (rewardUnlocked) {
            const rewardSent = await sendRewardEmail(cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, effective.rewardValidityDays, trackingUrl);
            if (rewardSent) {
              await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
              emailsSent++;
            }
          }
          // Process reminders for new status
          if (!rewardUnlocked && newStatus) {
            emailsSent += await processReminders(supabase, newStatus, cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, visits);
          }
        }
      }

      console.log("[loyalty-enroll] activate_customer DONE:", JSON.stringify({ visits, rewardUnlocked, emailsSent }));
      return new Response(JSON.stringify({ success: true, visits, rewardUnlocked, emailsSent }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // ── DEACTIVATE CUSTOMER ──
    if (action === "deactivate_customer" && body.customer_id) {
      console.log("[loyalty-enroll] deactivate_customer BLOCKED — program cannot be deactivated once enabled");
      return new Response(JSON.stringify({ error: "O programa de fidelidade não pode ser desativado após habilitado para o cliente." }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ── SAVE PROGRAM ──
    if (action === "save_program") {
      console.log("[loyalty-enroll] save_program — fetching all customers for restaurant:", restaurant_id);

      const { data: customers, error: custListError } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name, customer_email, customer_phone, total_manual_visits, total_queue_visits, total_reservation_visits, marketing_optin, loyalty_program_active")
        .eq("restaurant_id", restaurant_id);

      if (custListError) {
        console.error("[loyalty-enroll] Error fetching customers:", custListError);
        throw custListError;
      }

      console.log("[loyalty-enroll] Found", customers?.length || 0, "customers");

      let enrolled = 0;
      let emailsSent = 0;

      for (const cust of customers || []) {
        // ONLY process customers who have been individually activated
        if (!cust.loyalty_program_active) {
          continue;
        }

        let visits = 0;
        visits += (cust.total_manual_visits || 0);
        if (program.count_queue) visits += (cust.total_queue_visits || 0);
        if (program.count_reservations) visits += (cust.total_reservation_visits || 0);

        const { data: existing } = await supabase
          .from("customer_loyalty_status")
          .select("*")
          .eq("restaurant_id", restaurant_id)
          .eq("customer_id", cust.id)
          .maybeSingle();

        const effective = getEffectiveValues(existing, program);
        const rewardUnlocked = visits >= effective.requiredVisits;
        const nowDate = new Date();
        const rewardExpiresAt = rewardUnlocked
          ? new Date(nowDate.getTime() + effective.rewardValidityDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        if (existing) {
          await supabase.from("customer_loyalty_status").update({
            current_visits: visits, reward_unlocked: rewardUnlocked,
            reward_unlocked_at: rewardUnlocked && !existing.reward_unlocked ? nowDate.toISOString() : undefined,
            reward_expires_at: rewardUnlocked ? rewardExpiresAt : null,
          }).eq("id", existing.id);

          const trackingUrl = existing.loyalty_token ? `${TRACKING_BASE_URL}/${existing.loyalty_token}` : undefined;

          if (rewardUnlocked && !existing.reward_email_sent && cust.marketing_optin && (cust.customer_email || cust.customer_phone)) {
            const sent = await sendRewardEmail(cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, effective.rewardValidityDays, trackingUrl);
            if (sent) {
              await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", existing.id);
              emailsSent++;
            }
          }

          if (!rewardUnlocked) {
            emailsSent += await processReminders(supabase, existing, cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, visits);
          }
        } else {
          const { data: newStat } = await supabase.from("customer_loyalty_status").insert({
            restaurant_id, customer_id: cust.id, current_visits: visits,
            reward_unlocked: rewardUnlocked,
            reward_unlocked_at: rewardUnlocked ? nowDate.toISOString() : null,
            reward_expires_at: rewardExpiresAt,
            activation_email_sent: false, reward_email_sent: false,
          }).select("loyalty_token").single();

          const trackingUrl = newStat?.loyalty_token ? `${TRACKING_BASE_URL}/${newStat.loyalty_token}` : undefined;

          if (cust.marketing_optin && (cust.customer_email || cust.customer_phone)) {
            const visitsRemaining = Math.max(0, effective.requiredVisits - visits);
            const sent = await sendActivationEmail(cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, visits, visitsRemaining, trackingUrl);
            if (sent) {
              await supabase.from("customer_loyalty_status").update({ activation_email_sent: true }).eq("restaurant_id", restaurant_id).eq("customer_id", cust.id);
              emailsSent++;
            }
            if (rewardUnlocked) {
              const rewardSent = await sendRewardEmail(cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, effective.rewardValidityDays, trackingUrl);
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
        .select("id, customer_name, customer_email, customer_phone, total_manual_visits, total_queue_visits, total_reservation_visits, marketing_optin, loyalty_program_active")
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
      visits += (cust.total_manual_visits || 0);
      if (program.count_queue) visits += (cust.total_queue_visits || 0);
      if (program.count_reservations) visits += (cust.total_reservation_visits || 0);

      const { data: statusRow } = await supabase
        .from("customer_loyalty_status")
        .select("*")
        .eq("restaurant_id", restaurant_id)
        .eq("customer_id", cust.id)
        .maybeSingle();

      const effective = getEffectiveValues(statusRow, program);
      const rewardUnlocked = visits >= effective.requiredVisits;
      const nowDate = new Date();

      let emailsSent = 0;

      if (statusRow) {
        await supabase.from("customer_loyalty_status").update({
          current_visits: visits, reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked && !statusRow.reward_unlocked ? nowDate.toISOString() : statusRow.reward_unlocked_at,
          reward_expires_at: rewardUnlocked
            ? new Date(nowDate.getTime() + effective.rewardValidityDays * 24 * 60 * 60 * 1000).toISOString()
            : null,
        }).eq("id", statusRow.id);

        const trackingUrl = statusRow.loyalty_token ? `${TRACKING_BASE_URL}/${statusRow.loyalty_token}` : undefined;

        if (rewardUnlocked && !statusRow.reward_email_sent && cust.marketing_optin && (cust.customer_email || cust.customer_phone)) {
          const sent = await sendRewardEmail(cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, effective.rewardValidityDays, trackingUrl);
          if (sent) {
            await supabase.from("customer_loyalty_status").update({ reward_email_sent: true }).eq("id", statusRow.id);
            emailsSent++;
          }
        }

        // Send visit confirmation SMS with tracking link (every visit)
        if (!rewardUnlocked && cust.customer_phone) {
          const remaining = effective.requiredVisits - visits;
          const visitSmsText = `${restaurantName}: Visita registrada! Voce tem ${visits} de ${effective.requiredVisits} visitas no ${program.program_name}. Faltam ${remaining} para: ${effective.rewardDescription}.${trackingUrl ? ` Acompanhe: ${trackingUrl}` : ''}`;
          console.log("[loyalty-enroll] Sending visit confirmation SMS for check_reward");
          await sendSmsAndWhatsApp(cust.customer_phone, visitSmsText);
        }

        // Process reminder emails
        if (!rewardUnlocked) {
          emailsSent += await processReminders(supabase, statusRow, cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, visits);
        }
      } else {
        const rewardExpiresAt = rewardUnlocked
          ? new Date(nowDate.getTime() + effective.rewardValidityDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const { data: newStatus } = await supabase.from("customer_loyalty_status").insert({
          restaurant_id, customer_id: cust.id, current_visits: visits,
          reward_unlocked: rewardUnlocked,
          reward_unlocked_at: rewardUnlocked ? nowDate.toISOString() : null,
          reward_expires_at: rewardExpiresAt,
        }).select("*").single();

        if (!rewardUnlocked && newStatus) {
          emailsSent += await processReminders(supabase, newStatus, cust, program.program_name, restaurantName, effective.requiredVisits, effective.rewardDescription, visits);
        }
      }

      console.log("[loyalty-enroll] check_reward DONE:", JSON.stringify({ visits, rewardUnlocked, emailsSent }));
      return new Response(JSON.stringify({ success: true, visits, rewardUnlocked, emailsSent }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("[loyalty-enroll] UNHANDLED ERROR:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_MARKETING =
  Deno.env.get("RESEND_FROM_MARKETING") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "ofertas@mesaclik.com.br";
const FUNCTION_VERSION = "2026-03-06_v6_jwt_hardened";

// ── SECURITY FLAGS (env-based, fallback-safe) ──
const REQUIRE_JWT = (Deno.env.get("REQUIRE_JWT_SEND_PROMOTION") ?? "true") === "true";
const RATE_LIMIT_PER_MIN = parseInt(Deno.env.get("RATE_LIMIT_SEND_PROMOTION") ?? "10", 10);

// ── CORS (restricted allowlist) ──
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
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

// ── Simple in-memory rate limiter ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_PER_MIN) {
    return true;
  }
  return false;
}

// ── Auth helper ──
async function authenticateRequest(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<
  | { user: { id: string; email?: string }; error: null }
  | { user: null; error: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    if (REQUIRE_JWT) {
      console.warn("[send-promotion-direct] Missing JWT — blocked (REQUIRE_JWT=true)");
      return {
        user: null,
        error: new Response(
          JSON.stringify({ error: "Autenticação necessária" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        ),
      };
    }
    console.warn("[send-promotion-direct] Missing JWT — allowed (REQUIRE_JWT=false, compat mode)");
    return { user: { id: "anonymous" }, error: null };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    console.warn("[send-promotion-direct] Invalid JWT:", error?.message);
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { user: { id: data.user.id, email: data.user.email }, error: null };
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  from: string,
  text?: string,
  headers?: Record<string, string>
): Promise<{ id?: string; error?: string; last_event?: string }> {
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY secret");
    return { error: "Missing RESEND_API_KEY" };
  }

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
    console.error("Resend API error:", data);
    return { error: data.message || "Failed to send email" };
  }

  const id = data?.id as string | undefined;
  let lastEvent: string | undefined;

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
      console.warn("Failed to fetch Resend email status:", e);
    }
  }

  return { id, last_event: lastEvent };
}

interface PromotionEmailRequest {
  to_email?: string;
  to_phone?: string;
  to_name?: string;
  subject: string;
  message: string;
  coupon_code?: string;
  expires_at?: string;
  cta_text?: string;
  cta_url?: string;
  image_url?: string;
  restaurant_name?: string;
  unsubscribe_token?: string;
  site_url?: string;
}

async function sendTwilioMessage(
  to: string,
  body: string,
  channel: 'sms' | 'whatsapp'
): Promise<{ success: boolean; sid?: string; error?: string; channel: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_PHONE_NUMBER) {
    console.warn(`[send-promotion-direct] ${channel} keys missing, skipping`);
    return { success: false, error: `${channel} not configured`, channel };
  }

  const formattedPhone = to.startsWith('+') ? to : `+55${to.replace(/\D/g, '')}`;
  const formattedTo = channel === 'whatsapp' ? `whatsapp:${formattedPhone}` : formattedPhone;
  const formattedFrom = channel === 'whatsapp' ? `whatsapp:${TWILIO_PHONE_NUMBER}` : TWILIO_PHONE_NUMBER;
  const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

  try {
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: formattedFrom,
        Body: body,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`[send-promotion-direct] ${channel} error:`, data);
      return { success: false, error: data.message || `${channel} failed`, channel };
    }

    console.log(`[send-promotion-direct] ${channel} sent:`, data.sid);
    return { success: true, sid: data.sid, channel };
  } catch (err) {
    console.error(`[send-promotion-direct] ${channel} exception:`, err);
    return { success: false, error: err instanceof Error ? err.message : `${channel} error`, channel };
  }
}

const buildPromotionHtml = (data: PromotionEmailRequest): string => {
  const { to_name, message, coupon_code, expires_at, cta_url, image_url, restaurant_name, unsubscribe_token, site_url } = data;
  const name = to_name || "Cliente";
  const baseUrl = site_url || "https://mesaclik.com.br";
  const unsubscribeUrl = unsubscribe_token
    ? `${baseUrl}/marketing/unsubscribe?token=${unsubscribe_token}`
    : null;

  const formattedExpiry = expires_at
    ? new Date(expires_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  const imageBlock = image_url
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;"><tr><td align="center"><img src="${image_url}" alt="Imagem da promoção" style="max-width: 100%; height: auto; border-radius: 12px; display: block;" /></td></tr></table>`
    : "";

  const couponBlock = coupon_code
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border-radius: 12px; margin-bottom: 16px;"><tr><td style="padding: 20px; text-align: center;"><p style="margin: 0; color: #9a3412; font-size: 14px; font-weight: 600;">Cupom: ${coupon_code}</p>${formattedExpiry ? `<p style="margin: 8px 0 0; color: #71717a; font-size: 12px;">Válido até ${formattedExpiry}</p>` : ""}</td></tr></table>`
    : "";

  const ctaBlock = cta_url
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding: 8px 0 24px;"><a href="${cta_url}" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">Ver oferta</a></td></tr></table>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Oferta Especial</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);"><tr><td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;"><h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Oferta Especial</h1><p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurant_name || "MesaClik"}</p></td></tr><tr><td style="padding: 32px;"><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Olá <strong>${name}</strong>!</p><p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message}</p>${imageBlock}${couponBlock}${ctaBlock}<p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.6; text-align: center;">Esperamos você!</p></td></tr><tr><td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;"><p style="margin: 0; color: #a1a1aa; font-size: 12px;">Este e-mail foi enviado pelo ${restaurant_name || "MesaClik"}</p>${unsubscribeUrl ? `<p style="margin: 8px 0 0; color: #a1a1aa; font-size: 11px;"><a href="${unsubscribeUrl}" style="color: #a1a1aa; text-decoration: underline;">Se não quiser mais receber e-mails, clique aqui</a></p>` : ""}</td></tr></table></td></tr></table></body></html>`;
};

const sanitizeSubject = (subject: string): string =>
  subject
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH CHECK ──
    const auth = await authenticateRequest(req, corsHeaders);
    if (auth.error) return auth.error;

    // ── RATE LIMIT ──
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitKey = `${auth.user.id}:${clientIP}`;
    if (isRateLimited(rateLimitKey)) {
      console.warn(`[send-promotion-direct] Rate limited: ${rateLimitKey}`);
      return new Response(
        JSON.stringify({ error: "Limite de envios excedido. Tente novamente em 1 minuto." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("send-promotion-direct version:", FUNCTION_VERSION, "user:", auth.user.id);

    const requestData: PromotionEmailRequest = await req.json();

    console.log("Received promotion email request:", JSON.stringify({
      to_email: requestData.to_email,
      subject: requestData.subject,
      coupon_code: requestData.coupon_code || null,
      expires_at: requestData.expires_at || null,
      message_length: requestData.message?.length || 0,
    }));

    if ((!requestData.to_email && !requestData.to_phone) || !requestData.subject || !requestData.message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to_email or to_phone, subject, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailMessageId: string | undefined;
    let emailLastEvent: string | null = null;
    let smsSid: string | undefined;
    let whatsappSid: string | undefined;

    // Send email if email is provided
    if (requestData.to_email && !requestData.to_email.endsWith('@phone.local')) {
      const html = buildPromotionHtml(requestData);
      const safeSubject = sanitizeSubject(requestData.subject);
      const fromAddress = `Ofertas MesaClik <${RESEND_FROM_MARKETING}>`;
      const baseUrl = requestData.site_url || "https://mesaclik.com.br";
      const unsubUrl = requestData.unsubscribe_token
        ? `${baseUrl}/marketing/unsubscribe?token=${requestData.unsubscribe_token}`
        : null;

      const textBody = [
        requestData.to_name ? `Olá, ${requestData.to_name}!` : undefined,
        requestData.message,
        requestData.coupon_code ? `\nCupom: ${requestData.coupon_code}` : undefined,
        requestData.expires_at
          ? `Validade: ${new Date(requestData.expires_at).toLocaleDateString("pt-BR")}`
          : undefined,
        requestData.cta_url ? `\nVer oferta: ${requestData.cta_url}` : undefined,
        unsubUrl
          ? `\nCancelar recebimento: ${unsubUrl}`
          : "\nCancelar recebimento: suporte@mesaclik.com.br",
      ]
        .filter(Boolean)
        .join("\n");

      const headers: Record<string, string> = {
        "Reply-To": "suporte@mesaclik.com.br",
        Precedence: "bulk",
        "X-Auto-Response-Suppress": "DR, RN, NRN, OOF, AutoReply",
      };
      if (unsubUrl) {
        headers["List-Unsubscribe"] = `<${unsubUrl}>`;
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      } else {
        headers["List-Unsubscribe"] =
          "<mailto:suporte@mesaclik.com.br?subject=unsubscribe>";
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      }

      const emailResponse = await sendEmailViaResend(
        requestData.to_email,
        safeSubject,
        html,
        fromAddress,
        textBody,
        headers
      );

      if (emailResponse.error) {
        console.error("Failed to send email:", emailResponse.error);
      } else {
        emailMessageId = emailResponse.id;
        emailLastEvent = emailResponse.last_event ?? null;
        console.log("Promotion email sent successfully:", emailResponse.id);
      }
    }

    // Send SMS if phone is provided
    if (requestData.to_phone) {
      const restaurantName = requestData.restaurant_name || "MesaClik";
      const smsBody = [
        `${restaurantName}: ${requestData.message}`,
        requestData.coupon_code ? `Cupom: ${requestData.coupon_code}` : undefined,
        requestData.expires_at
          ? `Valido ate ${new Date(requestData.expires_at).toLocaleDateString("pt-BR")}`
          : undefined,
        requestData.cta_url ? `${requestData.cta_url}` : undefined,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1600);

      const smsResult = await sendSmsViaTwilio(requestData.to_phone, smsBody);
      if (smsResult.success) {
        smsSid = smsResult.sid;
      }
    }

    // If neither email nor SMS succeeded
    if (!emailMessageId && !smsSid) {
      return new Response(
        JSON.stringify({ success: false, error: "Falha ao enviar email e SMS" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailMessageId,
        smsSid: smsSid,
        last_event: emailLastEvent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending promotion email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

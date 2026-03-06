import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const RESEND_FROM_MARKETING =
  Deno.env.get("RESEND_FROM_MARKETING") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "ofertas@mesaclik.com.br";

function getRawEmailAddress(fromValue: string): string {
  return (fromValue || "ofertas@mesaclik.com.br").replace(/^.*</, "").replace(/>$/, "").trim();
}

// ── SECURITY FLAGS ──
const REQUIRE_JWT = (Deno.env.get("REQUIRE_JWT_SEND_CAMPAIGN") ?? "true") === "true";
const RATE_LIMIT_PER_MIN = parseInt(Deno.env.get("RATE_LIMIT_SEND_CAMPAIGN") ?? "5", 10);
const MAX_RECIPIENTS = 500;

// ── CORS (restricted allowlist) ──
const ALLOWED_ORIGINS = [
  "https://mesaclik.com.br", "https://www.mesaclik.com.br",
  "https://app.mesaclik.com.br", "https://painel.mesaclik.com.br",
  "http://localhost:5173", "http://localhost:3000", "http://localhost:8080",
];
const PREVIEW_ORIGIN_RE = /^https:\/\/.*\.lovable\.app$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

// ── Rate limiter ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_PER_MIN;
}

// ── Auth helper ──
async function authenticateRequest(req: Request, cors: Record<string, string>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    if (REQUIRE_JWT) {
      console.warn("[send-campaign-emails] Missing JWT — blocked");
      return { user: null, error: new Response(JSON.stringify({ error: "Autenticação necessária" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } }) };
    }
    console.warn("[send-campaign-emails] Missing JWT — compat mode");
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
  // Check restaurant_members OR global admin
  const { data: member } = await supabase.from("restaurant_members").select("role").eq("user_id", userId).eq("restaurant_id", restaurantId).maybeSingle();
  if (member) return true;
  const { data: admin } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!admin;
}

// ── Input validation ──
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateInput(body: any, cors: Record<string, string>): { valid: true; data: any } | { valid: false; error: Response } {
  const { campaign_id, restaurant_id, subject, message, recipients } = body;
  if (!campaign_id || typeof campaign_id !== "string") return { valid: false, error: new Response(JSON.stringify({ error: "campaign_id inválido" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }) };
  if (!restaurant_id || typeof restaurant_id !== "string") return { valid: false, error: new Response(JSON.stringify({ error: "restaurant_id inválido" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }) };
  if (!subject || typeof subject !== "string" || subject.length > 200) return { valid: false, error: new Response(JSON.stringify({ error: "subject inválido (máx 200 chars)" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }) };
  if (!message || typeof message !== "string" || message.length > 5000) return { valid: false, error: new Response(JSON.stringify({ error: "message inválido (máx 5000 chars)" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }) };
  if (!Array.isArray(recipients) || recipients.length === 0) return { valid: false, error: new Response(JSON.stringify({ error: "recipients deve ser array não vazio" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }) };
  if (recipients.length > MAX_RECIPIENTS) return { valid: false, error: new Response(JSON.stringify({ error: `Máximo ${MAX_RECIPIENTS} destinatários por request` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }) };
  for (const r of recipients) {
    if (!r.email || !EMAIL_RE.test(r.email)) return { valid: false, error: new Response(JSON.stringify({ error: `Email inválido: ${r.email?.slice(0, 50)}` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }) };
  }
  return { valid: true, data: body };
}

const handler = async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // 1. Auth
    const auth = await authenticateRequest(req, cors);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    // 2. Rate limit
    if (isRateLimited(userId)) {
      return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em 1 minuto." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3. Parse + validate input
    const body = await req.json();
    const validation = validateInput(body, cors);
    if (!validation.valid) return validation.error;

    const { campaign_id, restaurant_id, subject, message, cta_text, cta_url, coupon_code, expires_at, recipients } = body;

    // 4. Ownership check
    if (REQUIRE_JWT && userId !== "anonymous") {
      const owns = await validateOwnership(userId, restaurant_id);
      if (!owns) {
        console.warn(`[send-campaign-emails] User ${userId} blocked — not member of ${restaurant_id}`);
        return new Response(JSON.stringify({ error: "Acesso negado a este restaurante" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    console.log(`[send-campaign-emails] Campaign ${campaign_id} — ${recipients.length} recipients — by user ${userId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        const expiresText = expires_at
          ? `<p style="font-size: 12px; color: #888;">Válido até ${new Date(expires_at).toLocaleDateString('pt-BR')}</p>`
          : '';

        const couponHtml = coupon_code
          ? `<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; font-size: 12px; color: #666;">Use o código:</p>
              <p style="margin: 5px 0; font-size: 24px; font-weight: bold; color: #FF6B35; letter-spacing: 2px;">${coupon_code}</p>
              ${expiresText}
            </div>`
          : '';

        const ctaHtml = cta_text && cta_url
          ? `<div style="text-align: center; margin: 25px 0;">
              <a href="${cta_url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #FF6B35, #FF8E53); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${cta_text}</a>
            </div>`
          : '';

        const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%); color: white; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">🎉 Promoção Especial</h1>
              <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Olá${recipient.name ? `, ${recipient.name}` : ''}!</p>
            </div>
            <div style="background: white; padding: 30px 20px;">
              <div style="white-space: pre-wrap; font-size: 16px; line-height: 1.8;">${message}</div>
              ${couponHtml}${ctaHtml}
            </div>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0 0 10px;">Você está recebendo este e-mail porque aceitou receber ofertas deste restaurante.</p>
              <p style="margin: 0;"><a href="#" style="color: #FF6B35; text-decoration: none;">Cancelar recebimento</a></p>
              <p style="margin: 10px 0 0; font-size: 11px;">© ${new Date().getFullYear()} MesaClik. Todos os direitos reservados.</p>
            </div>
          </body></html>`;

        await resend.emails.send({
          from: `Ofertas MesaClik <${getRawEmailAddress(RESEND_FROM_MARKETING)}>` ,
          to: [recipient.email],
          subject,
          html: emailHtml,
        });

        await supabase.from('restaurant_campaign_recipients').update({
          delivery_status: 'sent', sent_at: new Date().toISOString(),
        }).eq('campaign_id', campaign_id).eq('customer_email', recipient.email);

        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${recipient.email}:`, error);
        await supabase.from('restaurant_campaign_recipients').update({
          delivery_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        }).eq('campaign_id', campaign_id).eq('customer_email', recipient.email);
        failCount++;
      }
    }

    console.log(`Campaign ${campaign_id}: ${successCount} sent, ${failCount} failed`);

    return new Response(JSON.stringify({ success: true, sent: successCount, failed: failCount }), {
      status: 200, headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (error: unknown) {
    console.error("Error in send-campaign-emails function:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);

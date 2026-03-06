import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// ALINHADO COM RESERVA: usar remetente transacional (notify@) para caixa principal
const RESEND_FROM_TRANSACTIONAL =
  Deno.env.get("RESEND_FROM_TRANSACTIONAL") ||
  "notify@mesaclik.com.br";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConsentRequest {
  customer_id: string;
  restaurant_id: string;
  site_url?: string;
}

function sanitizeSubject(subject: string): string {
  return subject
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const buildConsentEmailHtml = (
  customerName: string,
  restaurantName: string,
  optInUrl: string
): string => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receba ofertas exclusivas</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);">
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Ofertas exclusivas para voce</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurantName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Ola <strong>${customerName}</strong>!</p>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                O restaurante <strong>${restaurantName}</strong> gostaria de enviar promocoes e novidades exclusivas para voce por e-mail.
              </p>
              <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Clique no botao abaixo para autorizar:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${optInUrl}" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.4);">
                      Quero receber ofertas
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.6; text-align: center;">
                Se voce nao solicitou isso, ignore este e-mail.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                Enviado por ${restaurantName} via MesaClik
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[send-consent-request] Inicio do processamento");

    if (!RESEND_API_KEY) {
      console.error("[send-consent-request] RESEND_API_KEY ausente");
      throw new Error("Missing RESEND_API_KEY");
    }

    const { customer_id, restaurant_id, site_url }: ConsentRequest = await req.json();
    console.log("[send-consent-request] Payload:", { customer_id, restaurant_id, site_url });

    if (!customer_id || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: "customer_id and restaurant_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from("restaurant_customers")
      .select("customer_email, customer_name, unsubscribe_token, marketing_optin")
      .eq("id", customer_id)
      .eq("restaurant_id", restaurant_id)
      .single();

    if (customerError || !customer) {
      console.error("[send-consent-request] Cliente nao encontrado:", customerError);
      return new Response(
        JSON.stringify({ error: "Cliente nao encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[send-consent-request] Cliente:", {
      email: customer.customer_email,
      name: customer.customer_name,
      marketing_optin: customer.marketing_optin,
    });

    if (!customer.customer_email) {
      return new Response(
        JSON.stringify({ error: "Cliente sem e-mail cadastrado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (customer.marketing_optin) {
      return new Response(
        JSON.stringify({ error: "Cliente ja autorizou marketing" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get restaurant name
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurant_id)
      .single();

    const restaurantName = restaurant?.name || "Restaurante";
    const token = customer.unsubscribe_token;

    if (!token) {
      console.error("[send-consent-request] Cliente sem unsubscribe_token");
      return new Response(
        JSON.stringify({ error: "Token de consentimento ausente. Registre o cliente novamente." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build opt-in URL
    const baseUrl = site_url || "https://mesaclik.com.br";
    const optInUrl = `${baseUrl}/marketing/optin?token=${token}`;
    console.log("[send-consent-request] OptIn URL:", optInUrl);

    const customerName = customer.customer_name || "Cliente";
    const html = buildConsentEmailHtml(customerName, restaurantName, optInUrl);
    const subject = sanitizeSubject(`${restaurantName} - Receba ofertas exclusivas`);

    // ALINHADO COM RESERVA: usar remetente transacional para caixa principal
    const fromAddress = `${restaurantName} <${RESEND_FROM_TRANSACTIONAL}>`;
    console.log("[send-consent-request] Enviando de:", fromAddress, "para:", customer.customer_email);

    // Send via Resend - MESMO PADRÃO DA RESERVA (raw fetch)
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [customer.customer_email],
        subject,
        html,
        text: `Ola ${customerName}! O restaurante ${restaurantName} gostaria de enviar ofertas para voce. Acesse: ${optInUrl}`,
        headers: {
          "Reply-To": "suporte@mesaclik.com.br",
          "X-Entity-Ref-ID": `consent-${customer_id}-${Date.now()}`,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[send-consent-request] Resend erro:", data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || "Erro ao enviar e-mail" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[send-consent-request] Enviado com sucesso! ID:", data.id);

    // Verificar entrega (MESMO PADRÃO DA RESERVA)
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const statusRes = await fetch(`https://api.resend.com/emails/${data.id}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      const statusData = await statusRes.json();
      console.log("[send-consent-request] Status de entrega:", statusData.last_event || "pending");
    } catch (verifyErr) {
      console.warn("[send-consent-request] Verificacao falhou (nao-critico):", verifyErr);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("[send-consent-request] Erro fatal:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

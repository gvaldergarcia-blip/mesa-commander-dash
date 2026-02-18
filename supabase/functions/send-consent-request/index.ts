import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@mesaclik.com.br";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConsentRequest {
  customer_id: string;
  restaurant_id: string;
  site_url?: string;
}

const buildConsentEmailHtml = (
  customerName: string,
  restaurantName: string,
  optInUrl: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Receba promoções exclusivas</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Receba promoções exclusivas</h1>
                  <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurantName}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Olá <strong>${customerName}</strong>!</p>
                  <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                    O restaurante <strong>${restaurantName}</strong> gostaria de enviar promoções e novidades exclusivas para você.
                  </p>
                  <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                    Clique no botão abaixo para autorizar:
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding: 8px 0 24px;">
                        <a href="${optInUrl}" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.4);">
                          ✅ Quero receber promoções
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.6; text-align: center;">
                    Se você não solicitou isso, ignore este e-mail.
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
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const { customer_id, restaurant_id, site_url }: ConsentRequest = await req.json();

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
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (customer.marketing_optin) {
      return new Response(
        JSON.stringify({ error: "Cliente já autorizou marketing" }),
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

    // Build opt-in URL
    const baseUrl = site_url || "https://mesaclik.com.br";
    const optInUrl = `${baseUrl}/marketing/optin?token=${token}`;

    const html = buildConsentEmailHtml(
      customer.customer_name || "Cliente",
      restaurantName,
      optInUrl
    );

    const fromAddress = `${restaurantName} <${RESEND_FROM_EMAIL}>`;

    // Send via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [customer.customer_email],
        subject: `Receba promoções exclusivas do ${restaurantName}`,
        html,
        text: `Olá ${customer.customer_name || "Cliente"}! O restaurante ${restaurantName} gostaria de enviar promoções para você. Acesse: ${optInUrl}`,
        headers: {
          "Reply-To": "suporte@mesaclik.com.br",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || "Erro ao enviar e-mail" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Consent request email sent:", data.id);

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

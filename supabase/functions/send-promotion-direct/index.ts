import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "promocoes@mesaclik.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  from: string
): Promise<{ id?: string; error?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error("Resend API error:", data);
    return { error: data.message || "Failed to send email" };
  }
  
  return { id: data.id };
}

interface PromotionEmailRequest {
  to_email: string;
  to_name?: string;
  subject: string;
  message: string;
  coupon_code?: string;
  expires_at?: string;
  cta_text?: string;
  cta_url?: string;
  restaurant_name?: string;
}

const buildPromotionHtml = (data: PromotionEmailRequest): string => {
  const { to_name, message, coupon_code, expires_at, cta_text, cta_url, restaurant_name } = data;
  
  const expiresText = expires_at 
    ? `<p style="font-size: 12px; color: #888; margin-top: 8px;">Válido até ${new Date(expires_at).toLocaleDateString('pt-BR')}</p>`
    : '';
  
  const couponHtml = coupon_code
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border-radius: 12px; margin: 20px 0;">
        <tr>
          <td style="padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9a3412;">Use o código:</p>
            <p style="margin: 8px 0; font-size: 28px; font-weight: bold; color: #f97316; letter-spacing: 3px;">${coupon_code}</p>
            ${expiresText}
          </td>
        </tr>
      </table>`
    : '';
  
  const ctaHtml = cta_text && cta_url
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding: 24px 0;">
            <a href="${cta_url}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">
              ${cta_text}
            </a>
          </td>
        </tr>
      </table>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Promoção Especial</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;">
                  <p style="margin: 0 0 8px; font-size: 36px;">🎉</p>
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Promoção Especial</h1>
                  ${to_name ? `<p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Olá, ${to_name}!</p>` : ''}
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <div style="white-space: pre-wrap; font-size: 16px; line-height: 1.7; color: #3f3f46;">${message}</div>
                  
                  ${couponHtml}
                  ${ctaHtml}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="margin: 0 0 8px; color: #71717a; font-size: 12px;">
                    Você está recebendo este e-mail porque aceitou receber ofertas.
                  </p>
                  <p style="margin: 0; color: #a1a1aa; font-size: 11px;">
                    ${restaurant_name ? `© ${new Date().getFullYear()} ${restaurant_name}` : '© MesaClik'} • <a href="#" style="color: #f97316; text-decoration: none;">Cancelar recebimento</a>
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
    const requestData: PromotionEmailRequest = await req.json();
    
    console.log('Received promotion email request:', JSON.stringify({
      to_email: requestData.to_email,
      subject: requestData.subject,
      coupon_code: requestData.coupon_code || null,
      expires_at: requestData.expires_at || null,
      message_length: requestData.message?.length || 0,
    }));

    if (!requestData.to_email || !requestData.subject || !requestData.message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to_email, subject, message' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const html = buildPromotionHtml(requestData);
    const fromAddress = `${requestData.restaurant_name || 'MesaClik'} <${RESEND_FROM_EMAIL}>`;
    
    console.log('Sending promotion email to:', requestData.to_email);
    
    const emailResponse = await sendEmailViaResend(
      requestData.to_email,
      requestData.subject,
      html,
      fromAddress
    );

    if (emailResponse.error) {
      console.error('Failed to send email:', emailResponse.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResponse.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Promotion email sent successfully:', emailResponse.id);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error('Error sending promotion email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to send email' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

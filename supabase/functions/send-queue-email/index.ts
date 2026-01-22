import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to send email via Resend API
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

interface QueueEmailRequest {
  email: string;
  customer_name?: string;
  restaurant_name: string;
  position: number;
  party_size?: number;
  size_group?: string; // ex: "1-2 pessoas", "3-4 pessoas"
  estimated_wait_minutes?: number;
  type: 'entry' | 'called' | 'position_update';
  queue_url?: string;
}

const getEmailContent = (data: QueueEmailRequest) => {
  const { customer_name, restaurant_name, position, party_size, size_group, estimated_wait_minutes, type, queue_url } = data;
  const name = customer_name || 'Cliente';

  switch (type) {
    case 'entry':
      return {
        subject: `🎉 Você está na fila do ${restaurant_name}!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmação de Entrada na Fila</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;">
                        <p style="margin: 0 0 8px; font-size: 32px;">🎉</p>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Você está na fila!</h1>
                        <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurant_name}</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px;">
                        ${customer_name ? `<p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Olá <strong>${customer_name}</strong>!</p>` : ''}
                        
                        ${party_size ? `
                        <!-- Party Size -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border-radius: 12px; margin-bottom: 16px;">
                          <tr>
                            <td style="padding: 20px; text-align: center;">
                              <p style="margin: 0; color: #9a3412; font-size: 14px; font-weight: 600;">👥 ${party_size} ${party_size === 1 ? 'pessoa' : 'pessoas'}</p>
                              <p style="margin: 8px 0 0; color: #71717a; font-size: 12px;">Fila de ${size_group || `${party_size} pessoas`}</p>
                            </td>
                          </tr>
                        </table>
                        ` : ''}
                        
                        ${queue_url ? `
                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center" style="padding: 8px 0 24px;">
                              <a href="${queue_url}" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">
                                📱 Ver minha posição em tempo real
                              </a>
                            </td>
                          </tr>
                        </table>
                        ` : ''}
                        
                        <p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.6; text-align: center;">
                          Fique de olho! Avisaremos quando for a sua vez.
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;">
                        <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                          Este e-mail foi enviado pelo ${restaurant_name}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

    case 'called':
      return {
        subject: `🔔 É a sua vez no ${restaurant_name}!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>É a sua vez!</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px 16px 0 0;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🔔 É A SUA VEZ!</h1>
                        <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurant_name}</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px; text-align: center;">
                        <p style="margin: 0 0 24px; color: #3f3f46; font-size: 18px; line-height: 1.6;">
                          ${customer_name ? `<strong>${customer_name}</strong>, ` : ''}Dirija-se ao balcão agora!
                        </p>
                        
                        <!-- Alert Card -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 2px solid #fbbf24; border-radius: 12px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 24px; text-align: center;">
                              <p style="margin: 0; color: #92400e; font-size: 48px; line-height: 1;">🎉</p>
                              <p style="margin: 16px 0 0; color: #92400e; font-size: 16px; font-weight: 600;">Sua mesa está pronta!</p>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                          Por favor, apresente-se ao atendente.
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;">
                        <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                          Este e-mail foi enviado pelo ${restaurant_name}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };

    case 'position_update':
    default:
      return {
        subject: `📍 Atualização da fila - ${restaurant_name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Atualização da Fila</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 28px 32px 22px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800;">📍 Atualização da fila</h1>
                        <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">${restaurant_name}</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding: 28px 32px;">
                        <p style="margin: 0 0 16px; color: #3f3f46; font-size: 15px; line-height: 1.6;">
                          ${customer_name ? `Olá <strong>${customer_name}</strong>!` : 'Olá!'} A fila está andando!
                        </p>
                        
                        ${party_size ? `
                        <!-- Party Size -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border-radius: 12px; margin-bottom: 16px;">
                          <tr>
                            <td style="padding: 20px; text-align: center;">
                              <p style="margin: 0; color: #9a3412; font-size: 14px; font-weight: 600;">👥 ${party_size} ${party_size === 1 ? 'pessoa' : 'pessoas'}</p>
                              <p style="margin: 8px 0 0; color: #71717a; font-size: 12px;">Fila de ${size_group || `${party_size} pessoas`}</p>
                            </td>
                          </tr>
                        </table>
                        ` : ''}
                        
                        ${queue_url ? `
                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center" style="padding: 8px 0 24px;">
                              <a href="${queue_url}" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">
                                📱 Ver minha posição em tempo real
                              </a>
                            </td>
                          </tr>
                        </table>
                        ` : ''}
                        
                        <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.6; text-align: center;">
                          Aguarde, logo será a sua vez!
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 20px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;">
                        <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                          Este e-mail foi enviado pelo ${restaurant_name}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: QueueEmailRequest = await req.json();
    
    console.log('Received queue email request:', JSON.stringify({
      email: requestData.email,
      type: requestData.type,
      restaurant_name: requestData.restaurant_name,
      position: requestData.position,
    }));

    // Validate required fields
    if (!requestData.email || !requestData.restaurant_name || !requestData.type) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, restaurant_name, type' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { subject, html } = getEmailContent(requestData);

    console.log('Sending email with subject:', subject);

    const fromAddress = `${requestData.restaurant_name} <${RESEND_FROM_EMAIL}>`;
    console.log('Sending from:', fromAddress);
    
    const emailResponse = await sendEmailViaResend(
      requestData.email,
      subject,
      html,
      fromAddress
    );

    if (emailResponse.error) {
      console.error('Failed to send email:', emailResponse.error);
      return new Response(
        JSON.stringify({ error: emailResponse.error }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Email sent successfully:', JSON.stringify(emailResponse));

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error sending queue email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

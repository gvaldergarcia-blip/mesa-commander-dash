import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReservationEmailRequest {
  email: string;
  customer_name?: string;
  restaurant_name: string;
  restaurant_address?: string;
  restaurant_cuisine?: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes?: string;
  reservation_url: string;
  type: 'confirmation' | 'reminder' | 'canceled';
}

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

const getEmailContent = (data: ReservationEmailRequest) => {
  const { 
    customer_name, 
    restaurant_name, 
    restaurant_address,
    restaurant_cuisine,
    reservation_date, 
    reservation_time, 
    party_size, 
    notes,
    reservation_url, 
    type 
  } = data;
  
  const name = customer_name || 'Cliente';

  switch (type) {
    case 'confirmation':
      return {
        subject: `✅ Sua reserva foi confirmada - ${restaurant_name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reserva Confirmada</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 16px 16px 0 0;">
                        <p style="margin: 0 0 8px; font-size: 48px;">✅</p>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Reserva Confirmada!</h1>
                        <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurant_name}</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px;">
                        ${customer_name ? `<p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">Olá <strong>${customer_name}</strong>!</p>` : ''}
                        
                        <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                          Sua reserva foi confirmada com sucesso. Estamos ansiosos para recebê-lo!
                        </p>
                        
                        <!-- Reservation Details -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-radius: 12px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 24px;">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="padding: 8px 0;">
                                    <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">📅 Data</p>
                                    <p style="margin: 4px 0 0; color: #3f3f46; font-size: 16px; font-weight: 700;">${reservation_date}</p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0;">
                                    <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">🕐 Horário</p>
                                    <p style="margin: 4px 0 0; color: #3f3f46; font-size: 16px; font-weight: 700;">${reservation_time}</p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0;">
                                    <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">👥 Pessoas</p>
                                    <p style="margin: 4px 0 0; color: #3f3f46; font-size: 16px; font-weight: 700;">${party_size} ${party_size === 1 ? 'pessoa' : 'pessoas'}</p>
                                  </td>
                                </tr>
                                ${notes ? `
                                <tr>
                                  <td style="padding: 8px 0;">
                                    <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">📝 Observações</p>
                                    <p style="margin: 4px 0 0; color: #3f3f46; font-size: 14px;">${notes}</p>
                                  </td>
                                </tr>
                                ` : ''}
                              </table>
                            </td>
                          </tr>
                        </table>
                        
                        ${restaurant_address ? `
                        <!-- Restaurant Info -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border-radius: 12px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="margin: 0; color: #9a3412; font-size: 14px; font-weight: 600;">📍 Endereço</p>
                              <p style="margin: 8px 0 0; color: #3f3f46; font-size: 14px; line-height: 1.5;">${restaurant_address}</p>
                              ${restaurant_cuisine ? `<p style="margin: 8px 0 0; color: #71717a; font-size: 12px;">Culinária: ${restaurant_cuisine}</p>` : ''}
                            </td>
                          </tr>
                        </table>
                        ` : ''}
                        
                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center" style="padding: 8px 0 24px;">
                              <a href="${reservation_url}" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">
                                📱 Ver minha reserva
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.6; text-align: center;">
                          Clique no botão acima para ver detalhes, editar ou cancelar sua reserva.
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 32px; background-color: #fafafa; border-radius: 0 0 16px 16px; text-align: center;">
                        <p style="margin: 0; color: #16a34a; font-size: 12px; font-weight: 500;">
                          🔒 Reserva realizada com segurança via MesaClik
                        </p>
                        <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 11px;">
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

    case 'canceled':
      return {
        subject: `❌ Reserva cancelada - ${restaurant_name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reserva Cancelada</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef2f2;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(220, 38, 38, 0.15);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 16px 16px 0 0;">
                        <p style="margin: 0 0 8px; font-size: 48px;">❌</p>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Reserva Cancelada</h1>
                        <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurant_name}</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px; text-align: center;">
                        <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                          ${customer_name ? `Olá <strong>${customer_name}</strong>, ` : ''}Sua reserva para ${reservation_date} às ${reservation_time} foi cancelada.
                        </p>
                        <p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                          Se desejar, você pode fazer uma nova reserva a qualquer momento.
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

    case 'reminder':
    default:
      return {
        subject: `⏰ Lembrete: Sua reserva é amanhã - ${restaurant_name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Lembrete de Reserva</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fef6ee;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef6ee; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.15);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 32px 32px 24px; text-align: center; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0;">
                        <p style="margin: 0 0 8px; font-size: 48px;">⏰</p>
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Lembrete de Reserva</h1>
                        <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${restaurant_name}</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding: 32px;">
                        <p style="margin: 0 0 24px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                          ${customer_name ? `Olá <strong>${customer_name}</strong>! ` : ''}Não se esqueça da sua reserva amanhã!
                        </p>
                        
                        <!-- Reservation Details -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; border-radius: 12px; margin-bottom: 24px;">
                          <tr>
                            <td style="padding: 24px; text-align: center;">
                              <p style="margin: 0; color: #9a3412; font-size: 14px; font-weight: 600;">📅 ${reservation_date} às ${reservation_time}</p>
                              <p style="margin: 8px 0 0; color: #3f3f46; font-size: 16px; font-weight: 700;">👥 ${party_size} ${party_size === 1 ? 'pessoa' : 'pessoas'}</p>
                            </td>
                          </tr>
                        </table>
                        
                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td align="center" style="padding: 8px 0;">
                              <a href="${reservation_url}" style="display: inline-block; padding: 18px 36px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">
                                📱 Ver minha reserva
                              </a>
                            </td>
                          </tr>
                        </table>
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
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: ReservationEmailRequest = await req.json();
    
    console.log('Received reservation email request:', JSON.stringify({
      email: requestData.email,
      type: requestData.type,
      restaurant_name: requestData.restaurant_name,
      reservation_date: requestData.reservation_date,
    }));

    if (!requestData.email || !requestData.restaurant_name || !requestData.type || !requestData.reservation_url) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, restaurant_name, type, reservation_url' }),
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
    console.error('Error sending reservation email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

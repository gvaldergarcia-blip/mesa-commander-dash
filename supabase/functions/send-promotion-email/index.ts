import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PromotionEmailRequest {
  email_log_id: string;
  to_email: string;
  to_name: string;
  subject: string;
  body_html: string;
  restaurant_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email_log_id,
      to_email,
      to_name,
      subject,
      body_html,
      restaurant_id,
    }: PromotionEmailRequest = await req.json();

    console.log("Sending promotion email to:", to_email);

    // Validar opt-in (revalidação)
    // TODO: Adicionar verificação no banco de dados se o cliente tem opt-in ativo

    // Enviar email via Resend
    const emailResponse = await resend.emails.send({
      from: "MesaClik <promocoes@mesaclik.app>",
      to: [to_email],
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: white;
              padding: 30px;
              border: 1px solid #e0e0e0;
            }
            .footer {
              background: #f5f5f5;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #FF6B35;
              color: white !important;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .unsubscribe {
              color: #666;
              font-size: 11px;
              margin-top: 10px;
            }
            .unsubscribe a {
              color: #FF6B35;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 Promoção Especial</h1>
            <p>Olá, ${to_name}!</p>
          </div>
          <div class="content">
            ${body_html}
          </div>
          <div class="footer">
            <p>Este email foi enviado porque você aceitou receber ofertas do MesaClik.</p>
            <p class="unsubscribe">
              Não deseja mais receber nossas ofertas? 
              <a href="#">Clique aqui para cancelar</a>
            </p>
            <p>© 2025 MesaClik. Todos os direitos reservados.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResponse.data?.id || 'sent',
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-promotion-email function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

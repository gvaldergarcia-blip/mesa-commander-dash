import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_MARKETING =
  Deno.env.get("RESEND_FROM_MARKETING") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "ofertas@mesaclik.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PromotionEmailRequest {
  email_log_id: string;
  to_email: string;
  to_name: string;
  subject: string;
  body_html: string;
  restaurant_id: string;
}

function getRawEmailAddress(fromValue: string): string {
  return (fromValue || "ofertas@mesaclik.com.br").replace(/^.*</, "").replace(/>$/, "").trim();
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  from: string,
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
      reply_to: "suporte@mesaclik.com.br",
      headers: {
        Precedence: "bulk",
        "List-Unsubscribe": "<mailto:suporte@mesaclik.com.br?subject=unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Auto-Response-Suppress": "DR, RN, NRN, OOF, AutoReply",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Resend API error:", data);
    return { error: data.message || "Failed to send email" };
  }

  return { id: data.id };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      to_email,
      to_name,
      subject,
      body_html,
    }: PromotionEmailRequest = await req.json();

    console.log("Sending promotion email to:", to_email);

    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#f97316;color:white;padding:24px;text-align:center;border-radius:10px 10px 0 0;">
          <h1 style="margin:0;font-size:24px;">Promoção Especial</h1>
          <p style="margin:8px 0 0;">Olá, ${to_name || "Cliente"}!</p>
        </div>
        <div style="background:white;padding:24px;border:1px solid #e0e0e0;">
          ${body_html}
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#666;border-radius:0 0 10px 10px;">
          <p style="margin:0;">Este email foi enviado porque você aceitou receber ofertas do MesaClik.</p>
        </div>
      </body>
      </html>
    `;

    const fromAddress = `Ofertas MesaClik <${getRawEmailAddress(RESEND_FROM_MARKETING)}>`;
    const emailResponse = await sendEmailViaResend(to_email, subject, wrappedHtml, fromAddress);

    if (emailResponse.error) {
      return new Response(
        JSON.stringify({ success: false, error: emailResponse.error }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResponse.id || "sent",
        last_event: emailResponse.last_event ?? null,
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

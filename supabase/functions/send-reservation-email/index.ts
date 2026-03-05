import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_TRANSACTIONAL =
  Deno.env.get("RESEND_FROM_TRANSACTIONAL") ||
  Deno.env.get("RESEND_FROM_EMAIL") ||
  "notify@mesaclik.com.br";

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
  from: string,
  text: string,
  headers: Record<string, string>
): Promise<{ id?: string; error?: string }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to: [to], subject, html, text, headers }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Resend API error:", data);
    return { error: data.message || "Failed to send email" };
  }
  return { id: data.id };
}

function getSafeSenderName(restaurantName: string): string {
  const clean = (restaurantName || "MesaClik")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 40 ? clean.slice(0, 40) : clean || "MesaClik";
}

// ── Subject (NO emoji for Hotmail) ──────────────────────────────────
function buildSubject(data: ReservationEmailRequest): string {
  switch (data.type) {
    case 'confirmation':
      return `Reserva confirmada - ${data.restaurant_name}`;
    case 'canceled':
      return `Reserva cancelada - ${data.restaurant_name}`;
    case 'reminder':
    default:
      return `Lembrete de reserva - ${data.restaurant_name}`;
  }
}

// ── Plain text ──────────────────────────────────────────────────────
function buildPlainText(data: ReservationEmailRequest): string {
  const name = data.customer_name || 'Cliente';
  const base = [
    data.type === 'confirmation' ? `Reserva confirmada - ${data.restaurant_name}` :
    data.type === 'canceled'     ? `Reserva cancelada - ${data.restaurant_name}` :
                                   `Lembrete de reserva - ${data.restaurant_name}`,
    '',
    `Ola ${name}!`,
    `Data: ${data.reservation_date} as ${data.reservation_time}`,
    `Pessoas: ${data.party_size}`,
    '',
    data.reservation_url ? `Acompanhe: ${data.reservation_url}` : '',
    '',
    `Este e-mail foi enviado pelo ${data.restaurant_name}`,
  ];
  return base.filter(Boolean).join('\n');
}

// ── Minimal HTML (Outlook-safe: no gradients, no box-shadow) ────────
function buildHtml(data: ReservationEmailRequest): string {
  const { customer_name, restaurant_name, reservation_date, reservation_time, party_size, reservation_url, type } = data;
  const name = customer_name || 'Cliente';

  const headerBg = type === 'canceled' ? '#dc2626' : '#ea580c';
  const headerTitle =
    type === 'confirmation' ? 'Reserva Confirmada!' :
    type === 'canceled'     ? 'Reserva Cancelada' :
                              'Lembrete de Reserva';

  let bodyContent: string;

  if (type === 'canceled') {
    bodyContent = `
      <p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">
        ${customer_name ? `Ola <strong>${customer_name}</strong>, s` : 'S'}ua reserva para ${reservation_date} as ${reservation_time} foi cancelada.
      </p>
      <p style="margin:0;color:#6b7280;font-size:14px;">Se desejar, voce pode fazer uma nova reserva a qualquer momento.</p>`;
  } else {
    bodyContent = `
      ${customer_name ? `<p style="margin:0 0 16px;color:#1f2937;font-size:16px;line-height:1.6;">Ola <strong>${customer_name}</strong>!</p>` : ''}
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        ${type === 'confirmation' ? 'Sua reserva foi confirmada com sucesso.' : 'Nao se esqueca da sua reserva!'}
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr><td style="padding:16px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;text-align:center;">
          <p style="margin:0;color:#9a3412;font-size:14px;font-weight:600;">${reservation_date} as ${reservation_time}</p>
          <p style="margin:4px 0 0;color:#1f2937;font-size:16px;font-weight:700;">${party_size} ${party_size === 1 ? 'pessoa' : 'pessoas'}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr><td align="center">
          <a href="${reservation_url}" style="display:inline-block;padding:14px 32px;background-color:#ea580c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">
            Ver minha reserva
          </a>
        </td></tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no">
  <title>${headerTitle}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f9fafb;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
          <tr>
            <td style="padding:28px 24px;text-align:center;background-color:${headerBg};border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${headerTitle}</h1>
              <p style="margin:8px 0 0;color:#ffffff;font-size:15px;opacity:0.9;">${restaurant_name}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;background-color:#f9fafb;border-radius:0 0 8px 8px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">Este e-mail foi enviado pelo ${restaurant_name}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────────────
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: ReservationEmailRequest = await req.json();

    console.log('Reservation email request:', JSON.stringify({
      email: requestData.email,
      type: requestData.type,
      restaurant_name: requestData.restaurant_name,
      reservation_date: requestData.reservation_date,
    }));

    if (!requestData.email || !requestData.restaurant_name || !requestData.type || !requestData.reservation_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = buildSubject(requestData);
    const html = buildHtml(requestData);
    const text = buildPlainText(requestData);
    const senderName = getSafeSenderName(requestData.restaurant_name);
    const fromAddress = `MesaClik <${RESEND_FROM_TRANSACTIONAL}>`;

    // Headers transacionais enxutos (menos risco de junk no Hotmail)
    const emailHeaders: Record<string, string> = {
      "Reply-To": "suporte@mesaclik.com.br",
      "X-Entity-Ref-ID": crypto.randomUUID(),
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "DR, RN, NRN, OOF, AutoReply",
    };

    console.log('Sending from:', fromAddress, '| Sender:', senderName, '| Subject:', subject);

    const emailResponse = await sendEmailViaResend(
      requestData.email,
      subject,
      html,
      fromAddress,
      text,
      emailHeaders,
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
